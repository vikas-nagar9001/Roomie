import mongoose from 'mongoose';
import { InsertUser as InsertUserSchema, User as UserSchema, InsertFlat, Flat, Role, UserStatus } from '@shared/schema';
import session from 'express-session';
import MongoStore from 'connect-mongo';

// MongoDB Schemas
const flatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  flatUsername: { type: String, required: true, unique: true }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['ADMIN', 'CO_ADMIN', 'USER'], default: 'USER' },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'DEACTIVATED'], default: 'PENDING' },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flat', required: true },
  inviteToken: { type: String },
  inviteExpiry: { type: Date },
  resetToken: { type: String },
  resetExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// MongoDB Models
const FlatModel = mongoose.model('Flat', flatSchema);
const UserModel = mongoose.model('User', userSchema);

export interface IStorage {
  connect(): Promise<void>;
  getUser(id: string): Promise<UserSchema | undefined>;
  getUserByEmail(email: string): Promise<UserSchema | undefined>;
  getUserByInviteToken(token: string): Promise<UserSchema | undefined>;
  getUsersByFlatId(flatId: string): Promise<UserSchema[]>;
  createUser(user: Partial<UserSchema>): Promise<UserSchema>;
  createFlat(flat: InsertFlat): Promise<Flat>;
  updateUser(id: string, data: Partial<UserSchema>): Promise<UserSchema | undefined>;
  sessionStore: session.Store;
}

export class MongoStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60 // 1 day
    });
  }

  async connect() {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');
  }

  private convertId(doc: any): any {
    if (!doc) return undefined;
    const converted = {
      ...doc,
      _id: doc._id?.toString() || doc._id,
    };

    // Only convert flatId if it exists
    if (doc.flatId) {
      converted.flatId = doc.flatId.toString();
    }

    return converted;
  }

  async getUser(id: string): Promise<UserSchema | undefined> {
    const user = await UserModel.findById(id);
    return this.convertId(user?.toObject());
  }

  async getUserByEmail(email: string): Promise<UserSchema | undefined> {
    const user = await UserModel.findOne({ email });
    return this.convertId(user?.toObject());
  }

  async getUserByInviteToken(token: string): Promise<UserSchema | undefined> {
    const user = await UserModel.findOne({ inviteToken: token });
    return this.convertId(user?.toObject());
  }

  async getUsersByFlatId(flatId: string): Promise<UserSchema[]> {
    const users = await UserModel.find({ flatId });
    return users.map(user => this.convertId(user.toObject()));
  }

  async createUser(userData: Partial<UserSchema>): Promise<UserSchema> {
    const user = new UserModel(userData);
    await user.save();
    return this.convertId(user.toObject());
  }

  async createFlat(flatData: InsertFlat): Promise<Flat> {
    const flat = new FlatModel(flatData);
    await flat.save();
    return this.convertId(flat.toObject());
  }

  async updateUser(id: string, data: Partial<UserSchema>): Promise<UserSchema | undefined> {
    const user = await UserModel.findByIdAndUpdate(id, data, { new: true });
    return this.convertId(user?.toObject());
  }
}

export const storage = new MongoStorage();