import mongoose from "mongoose";
import dotenv from 'dotenv';
import { InsertPenaltySettings, PenaltySettingsDocument } from "./schema"; // Import both interfaces
dotenv.config();
import {
  InsertUser as InsertUserSchema,
  User as UserSchema,
  InsertFlat,
  Flat,
  Role,
  UserStatus,
  Activity as ActivitySchema,
  InsertActivity,
  Entry,
  InsertPenalty,
  Penalty,
  PenaltySettings,
} from "@shared/schema";
import session from "express-session";
import MongoStore from "connect-mongo";


// MongoDB Schemas
const flatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  flatUsername: { type: String, required: true, unique: true },
  minApprovalAmount: { type: Number, default: 200 },
  paymentSettings: {
    defaultDueDate: { type: Number, default: 5 }, // 5th of every month
    penaltyAmount: { type: Number, default: 50 }, // ₹50 per day
    reminderFrequency: { type: Number, default: 3 }, // Days before due date
    customSplitEnabled: { type: Boolean, default: false }
  }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ["ADMIN", "CO_ADMIN", "USER"], default: "USER" },
  status: {
    type: String,
    enum: ["PENDING", "ACTIVE", "DEACTIVATED"],
    default: "PENDING",
  },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  profilePicture: { type: String },
  inviteToken: { type: String },
  inviteExpiry: { type: Date },
  resetToken: { type: String },
  resetExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: [
      "LOGIN",
      "UPDATE_PROFILE",
      "CHANGE_PASSWORD",
      "FLAT_MANAGEMENT",
      "ENTRY_ADDED",
      "ENTRY_UPDATED",
      "ENTRY_DELETED",
      "ENTRY_RESTORED",
      "USER_DELETED",
      "PENALTY_ADDED",
      "PENALTY_UPDATED",
      "PENALTY_DELETED",
    ],
    required: true,
  },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const penaltySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  type: {
    type: String,
    enum: ["LATE_PAYMENT", "DAMAGE", "RULE_VIOLATION", "OTHER", "MINIMUM_ENTRY"],
    required: true,
  },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  image: { type: String },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  nextPenaltyDate: { type: Date }
});

const penaltySettingsSchema = new mongoose.Schema({
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  contributionPenaltyPercentage: { type: Number, default: 3 }, // Default 3%
  warningPeriodDays: { type: Number, default: 3 }, // Default 3 days
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastPenaltyAppliedAt: { type: Date, default: Date.now }, // Initialize with current date
  selectedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] // Array of selected users for penalties, empty array by default
});

const entrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  dateTime: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING",
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
});

// MongoDB Models
const FlatModel = mongoose.model("Flat", flatSchema);
const UserModel = mongoose.model("User", userSchema);
const ActivityModel = mongoose.model("Activity", activitySchema);
// Payment and Bill schemas

const billSchema = new mongoose.Schema({
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  month: { type: String, required: true },
  year: { type: Number, required: true },
  items: [{
    name: { type: String, required: true },
    amount: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  splitAmount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  penalty: { type: Number, default: 0 },
  penaltyWaived: { type: Boolean, default: false },
  status: { type: String, enum: ["PAID", "PENDING"], default: "PENDING" },
  dueDate: { type: Date, required: true },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const EntryModel = mongoose.model("Entry", entrySchema);
const BillModel = mongoose.model("Bill", billSchema);
const PaymentModel = mongoose.model("Payment", paymentSchema);
const PenaltyModel = mongoose.model("Penalty", penaltySchema);
const PenaltySettingsModel = mongoose.model("PenaltySettings", penaltySettingsSchema);

export interface IStorage {
  connect(): Promise<void>;
  getEntriesByFlatId(flatId: string): Promise<any[]>;
  getFlat(flatId: string): Promise<Flat | undefined>;
  getFlatById(flatId: string): Promise<Flat | undefined>;
  createEntry(entryData: Partial<Entry>): Promise<Entry>;
  getUser(id: string): Promise<UserSchema | undefined>;
  getUserByEmail(email: string): Promise<UserSchema | undefined>;
  getUserByInviteToken(token: string): Promise<UserSchema | undefined>;
  getUserByResetToken(token: string): Promise<UserSchema | undefined>;
  getUsersByFlatId(flatId: string): Promise<UserSchema[]>;
  getAllUsersByFlatId(flatId: string): Promise<UserSchema[]>; // New method
  createUser(user: Partial<UserSchema>): Promise<UserSchema>;
  createFlat(flat: InsertFlat): Promise<Flat>;
  updateUser(
    id: string,
    data: Partial<UserSchema>,
  ): Promise<UserSchema | undefined>;
  logActivity(activity: InsertActivity): Promise<ActivitySchema>;
  getUserActivities(userId: string): Promise<ActivitySchema[]>;
  createBill(data: any): Promise<any>;
  getBillsByFlatId(flatId: string): Promise<any[]>;
  deleteEntry(id: string): Promise<boolean>;
  // Penalty methods
  createPenalty(penaltyData: InsertPenalty & { flatId: string, createdBy: string }): Promise<Penalty>;
  getPenaltiesByFlatId(flatId: string): Promise<Penalty[]>;
  getPenaltiesByUserId(userId: string): Promise<Penalty[]>;
  updatePenalty(id: string, data: Partial<Penalty>): Promise<Penalty | undefined>;
  deletePenalty(id: string): Promise<boolean>;
  getPenaltyTotalsByFlatId(flatId: string, userId?: string): Promise<{ userTotal: number; flatTotal: number }>;
  // Penalty Settings methods
  getPenaltySettings(flatId: string): Promise<PenaltySettings | undefined>;
  createPenaltySettings(data: InsertPenaltySettings & { updatedBy: string }): Promise<PenaltySettings>;
  updatePenaltySettings(flatId: string, data: Partial<PenaltySettings>): Promise<PenaltySettings | undefined>;
  sessionStore: session.Store;
}
import type { MongoClient } from 'mongodb';

export class MongoStorage implements IStorage {
  sessionStore: session.Store;
  clientPromise: Promise<MongoClient>;

  constructor() {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    const store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 30 * 24 * 60 * 60,
      autoRemove: 'native'
    });

    this.sessionStore = store;

    // ⛳ Extract the clientPromise if available
    this.clientPromise = (store as any).clientPromise;
    if (!this.clientPromise) {
      throw new Error('clientPromise is not available on the session store');
    }
  }


  async destroySessionsByUserId(userId: string) {
    // Access the sessions collection directly using the MongoDB client from the session store
    const client = await this.clientPromise;
    const db = client.db(); // Uses the default database from the connection string
    await db.collection('sessions');
  }




  //in auth.ts
  //browser cookie will be set to expire in 30 days so in mongo the stored session will be removed after 30 days

  async getFlatById(flatId: string): Promise<Flat | undefined> {
    try {
      const flat = await FlatModel.findById(flatId).lean();
      return flat ? this.convertId(flat) : undefined;
    } catch (error) {
      console.error(`[ERROR] Error getting flat by ID:`, error);
      return undefined;
    }
  }

  // Penalty methods implementation
  async createPenalty(penaltyData: InsertPenalty & { flatId: string, createdBy: string }): Promise<Penalty> {
    const penalty = await PenaltyModel.create(penaltyData);
    return this.convertId(penalty.toObject());
  }

  async getPenaltiesByFlatId(flatId: string): Promise<Penalty[]> {
    const penalties = await PenaltyModel.find({ flatId, isDeleted: false })
      .populate('userId', 'name email profilePicture')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // console.log('Raw penalties from database:', JSON.stringify(penalties.slice(0, 2)));

    const convertedPenalties = penalties.map(this.convertId);

    return convertedPenalties;
  }

  async getPenaltiesByUserId(userId: string): Promise<Penalty[]> {
    const penalties = await PenaltyModel.find({ userId, isDeleted: false })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    return penalties.map(this.convertId);
  }

  async updatePenalty(id: string, data: Partial<Penalty>): Promise<Penalty | undefined> {
    const penalty = await PenaltyModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    )
      .populate('userId', 'name email profilePicture')
      .populate('createdBy', 'name')
      .lean();
    return penalty ? this.convertId(penalty) : undefined;
  }

  async deletePenalty(id: string): Promise<boolean> {
    const result = await PenaltyModel.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    return !!result;
  }

  async getPenaltyTotalsByFlatId(flatId: string, userId?: string): Promise<{ userTotal: number; flatTotal: number }> {
    const penalties = await PenaltyModel.find({ flatId, isDeleted: false }).lean();

    // Calculate total penalties for the flat
    const flatTotal = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);

    // Get the specified user's penalties or 0 if no userId provided
    const userTotal = userId ? penalties
      .filter(penalty => penalty.userId.toString() === userId)
      .reduce((sum, penalty) => sum + penalty.amount, 0) : 0;

    return { userTotal, flatTotal };
  }

  // Penalty Settings methods
  async getPenaltySettings(flatId: string): Promise<PenaltySettings | undefined> {
    const settings = await PenaltySettingsModel.findOne({ flatId }).lean();
    return settings ? this.convertId(settings) : undefined;
  }



  async createPenaltySettings(data: InsertPenaltySettings & { updatedBy: mongoose.Types.ObjectId }): Promise<PenaltySettingsDocument> {
    const settings = new PenaltySettingsModel({
      ...data,
      updatedAt: new Date(),
      lastPenaltyAppliedAt: new Date(), // ✅ Store the current date instead of null
    });

    await settings.save();
    return settings.toObject(); // Ensure it returns the correct structure
  }





  async updatePenaltySettings(flatId: string, data: Partial<PenaltySettings>): Promise<PenaltySettings | undefined> {
    const settings = await PenaltySettingsModel.findOneAndUpdate(
      { flatId },
      {
        $set: {
          ...data,
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true }
    ).lean();

    return settings ? this.convertId(settings) : undefined;
  }



  async updateLastPenaltyDate(flatId: string, date: Date) {
    console.log("Updating lastPenaltyAppliedAt...");
    console.log("Date:", date);
    console.log("Flat ID:", flatId);

    const result = await PenaltySettingsModel.updateOne(
      { flatId: new mongoose.Types.ObjectId(flatId) },
      { $set: { lastPenaltyAppliedAt: date } }
    );

    console.log("Update result:", result);

    if (result.modifiedCount > 0) {
      console.log("✅ Success: lastPenaltyAppliedAt updated for Flat ID:", flatId);
    } else {
      console.warn("⚠️ Warning: No document updated for Flat ID:", flatId);
    }
  }



  async connect() {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to MongoDB");
  }

  convertId<T extends Record<string, any>>(obj: T): T {
    if (!obj) return obj;

    // Create a new object to avoid modifying the original
    const result: any = { ...obj };

    // Convert _id to string if it exists
    if (obj._id) {
      result._id = obj._id.toString();
    }

    // Handle nested objects like userId and createdBy
    if (obj.userId && typeof obj.userId === 'object' && obj.userId._id) {
      // Keep the userId as an object but convert its _id
      result.userId = { ...obj.userId };
      result.userId._id = obj.userId._id.toString();
    }

    if (obj.createdBy && typeof obj.createdBy === 'object' && obj.createdBy._id) {
      // Keep the createdBy as an object but convert its _id
      result.createdBy = { ...obj.createdBy };
      result.createdBy._id = obj.createdBy._id.toString();
    }

    return result;
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
    const users = await UserModel.find({
      flatId,
      status: { $ne: "PENDING" } // Exclude users with PENDING status
    }).lean();
    return users.map(user => ({
      ...user,
      _id: user._id.toString(),
      flatId: user.flatId.toString()
    })) as UserSchema[];
  }

  async getAllUsersByFlatId(flatId: string): Promise<UserSchema[]> {
    const users = await UserModel.find({ flatId }).lean();
    return users.map(user => ({
      ...user,
      _id: user._id.toString(),
      flatId: user.flatId.toString()
    })) as UserSchema[];
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

  async updateUser(
    id: string,
    data: Partial<UserSchema>,
  ): Promise<UserSchema | undefined> {
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

  async clearUserActivities(userId: string): Promise<void> {
    await ActivityModel.deleteMany({ userId });
  }

  async getUserEntriesTotal(userId: string): Promise<number> {
    const entries = await EntryModel.find({ userId: userId, isDeleted: false });
    return entries.reduce((total, entry) => {
      // Ensure we're comparing the correct userId
      const entryUserId = typeof entry.userId === 'object' ? entry.userId._id?.toString() : entry.userId?.toString();
      if (entryUserId === userId) {
        return total + entry.amount;
      }
      return total;
    }, 0);
  }


  async getEntriesByFlatId(flatId: string) {
    const entries = await EntryModel.find({ flatId, isDeleted: false })
      .populate('userId', 'name email profilePicture');
    return entries.map((entry) => this.convertId(entry.toObject()));
  }

  async getFlat(flatId: string): Promise<Flat | undefined> {
    const flat = await FlatModel.findById(flatId);
    return this.convertId(flat?.toObject());
  }
  async getAllFlats() {
    return await FlatModel.find({});
  }

  async createEntry(entryData: Partial<Entry>): Promise<Entry> {
    const entry = new EntryModel(entryData);
    await entry.save();
    return this.convertId(entry.toObject());
  }

  async updateEntry(
    id: string,
    data: Partial<Entry>,
  ): Promise<Entry | undefined> {
    const entry = await EntryModel.findByIdAndUpdate(id, data, { new: true });
    return this.convertId(entry?.toObject());
  }

  async createBill(data: any): Promise<any> {
    const bill = new BillModel(data);
    await bill.save();
    return this.convertId(bill.toObject());
  }

  async getBillsByFlatId(flatId: string): Promise<any[]> {
    const bills = await BillModel.find({ flatId }).sort({ createdAt: -1 });
    return bills.map(bill => this.convertId(bill.toObject()));
  }

  async createPayment(data: any): Promise<any> {
    const payment = new PaymentModel(data);
    await payment.save();
    return this.convertId(payment.toObject());
  }

  async getPaymentsByFlatId(flatId: string): Promise<any[]> {
    const payments = await PaymentModel.find({ flatId })
      .populate({
        path: 'userId',
        select: 'name email profilePicture'
      })
      .sort({ createdAt: -1 });
    return payments.map(payment => {
      const obj = payment.toObject();
      return {
        ...this.convertId(obj),
        userId: obj.userId ? this.convertId(obj.userId) : null
      };
    });
  }

  async deleteEntry(id: string): Promise<boolean> {
    try {
      const result = await EntryModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("Failed to delete entry:", error);
      return false;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // Delete user's entries
      await EntryModel.deleteMany({ userId: id });

      // Delete user's activities
      await ActivityModel.deleteMany({ userId: id });

      // Delete user's payments
      await PaymentModel.deleteMany({ userId: id });

      // Finally, delete the user
      const result = await UserModel.findByIdAndDelete(id);

      return !!result;
    } catch (error) {
      console.error("Failed to delete user:", error);
      return false;
    }
  }

  async updateFlat(flatId: string, update: Partial<Flat>) {
    const updatedFlat = await FlatModel.findByIdAndUpdate(
      flatId,
      { $set: update },
      { new: true }
    ).exec();

    return updatedFlat ? this.convertId(updatedFlat.toObject()) : undefined;
  }
}

export const storage = new MongoStorage();