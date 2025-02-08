import mongoose from 'mongoose';
import { InsertUser as InsertUserSchema, User as UserSchema, InsertFlat, Flat, Role, UserStatus, Activity as ActivitySchema, InsertActivity } from '@shared/schema';
import session from 'express-session';
import MongoStore from 'connect-mongo';

// MongoDB Schemas
const flatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  flatUsername: { type: String, required: true, unique: true },
  minApprovalAmount: { type: Number, default: 200 }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['ADMIN', 'CO_ADMIN', 'USER'], default: 'USER' },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'DEACTIVATED'], default: 'PENDING' },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flat', required: true },
  profilePicture: { type: String },
  inviteToken: { type: String },
  inviteExpiry: { type: Date },
  resetToken: { type: String },
  resetExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['LOGIN', 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'FLAT_MANAGEMENT'], required: true },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const entrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  dateTime: { type: Date, default: Date.now },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flat', required: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
});

// MongoDB Models
const FlatModel = mongoose.model('Flat', flatSchema);
const UserModel = mongoose.model('User', userSchema);
const ActivityModel = mongoose.model('Activity', activitySchema);
const EntryModel = mongoose.model('Entry', entrySchema);

export interface IStorage {
  connect(): Promise<void>;
  getUser(id: string): Promise<UserSchema | undefined>;
  getUserByEmail(email: string): Promise<UserSchema | undefined>;
  getUserByInviteToken(token: string): Promise<UserSchema | undefined>;
  getUserByResetToken(token: string): Promise<UserSchema | undefined>;
  getUsersByFlatId(flatId: string): Promise<UserSchema[]>;
  createUser(user: Partial<UserSchema>): Promise<UserSchema>;
  createFlat(flat: InsertFlat): Promise<Flat>;
  updateUser(id: string, data: Partial<UserSchema>): Promise<UserSchema | undefined>;
  logActivity(activity: InsertActivity): Promise<ActivitySchema>;
  getUserActivities(userId: string): Promise<ActivitySchema[]>;
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

    if (doc.flatId) {
      converted.flatId = doc.flatId.toString();
    }

    if (doc.userId) {
      converted.userId = doc.userId.toString();
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

  async getUserByResetToken(token: string): Promise<UserSchema | undefined> {
    const user = await UserModel.findOne({ resetToken: token });
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

  async logActivity(activityData: InsertActivity): Promise<ActivitySchema> {
    const activity = new ActivityModel(activityData);
    await activity.save();
    return this.convertId(activity.toObject());
  }

  async getUserActivities(userId: string): Promise<ActivitySchema[]> {
    const activities = await ActivityModel.find({ userId }).sort({ timestamp: -1 });
    return activities.map(activity => this.convertId(activity.toObject()));
  }

  async getUserEntriesTotal(userId: string): Promise<number> {
    const entries = await EntryModel.find({ userId, isDeleted: false });
    return entries.reduce((total, entry) => total + entry.amount, 0);
  }
}

export const storage = new MongoStorage();