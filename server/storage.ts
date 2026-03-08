import mongoose from "mongoose";
import dotenv from 'dotenv';
import { InsertPenaltySettings, PenaltySettingsDocument } from "../shared/schema"; // Import both interfaces
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
  PushSubscription,
} from "@shared/schema";
import session from "express-session";
import MongoStore from "connect-mongo";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  pushSubscriptions: [{
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  }],
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
      "PAYMENT_ADDED",
      "PAYMENT_STATUS_UPDATED",
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
  createdAt: { type: Date, default: Date.now }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  nextPenaltyDate: { type: Date },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null } // null = not yet applied to any bill
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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null } // null = not yet counted in any bill
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
    amount: { type: Number, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] // empty = all members
  }],
  totalAmount: { type: Number, required: true },
  splitAmount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  entryDeductionEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  flatId: { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  amount: { type: Number, required: true },        // base split amount per person
  paidAmount: { type: Number, default: 0 },        // how much has been received
  carryForwardAmount: { type: Number, default: 0 }, // unpaid balance from previous bill
  entryDeduction: { type: Number, default: 0 },    // approved entries deducted from share
  totalDue: { type: Number, default: 0 },          // amount + carryForward - entryDeduction
  penalty: { type: Number, default: 0 },
  penaltyWaived: { type: Boolean, default: false },
  status: { type: String, enum: ["PAID", "PENDING"], default: "PENDING" },
  dueDate: { type: Date, required: true },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export const EntryModel = mongoose.model("Entry", entrySchema);
export const BillModel = mongoose.model("Bill", billSchema);
export const PaymentModel = mongoose.model("Payment", paymentSchema);
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
  deleteFlat(flatId: string, adminUserId: string): Promise<boolean>;
  updateUser(
    id: string,
    data: Partial<UserSchema>,
  ): Promise<UserSchema | undefined>;
  logActivity(activity: InsertActivity): Promise<ActivitySchema>;
  getUserActivities(userId: string): Promise<ActivitySchema[]>;
  createBill(data: any): Promise<any>;
  getBillsByFlatId(flatId: string): Promise<any[]>;
  getBillById(billId: string): Promise<any>;
  updateBill(billId: string, data: any): Promise<any>;
  deleteBill(billId: string): Promise<boolean>;
  deleteAllBillsByFlatId(flatId: string): Promise<{ deletedBills: number; deletedPayments: number }>;
  createPayment(data: any): Promise<any>;
  getPaymentsByBillId(billId: string): Promise<any[]>;
  updatePayment(id: string, data: any): Promise<any>;
  getLastPaymentForUser(userId: string, flatId: string): Promise<any>;
  adjustPaymentPenalty(userId: string, flatId: string, amountDelta: number, billId?: string): Promise<boolean>;
  getUnappliedEntriesByFlatId(flatId: string): Promise<any[]>;
  markEntriesAppliedToBill(entryIds: string[], billId: string): Promise<void>;
  getEntriesByBillId(billId: string): Promise<any[]>;
  getUnappliedPenaltiesForUser(userId: string, flatId: string): Promise<any[]>;
  markPenaltiesAppliedToBill(penaltyIds: string[], billId: string): Promise<void>;
  deleteEntry(id: string): Promise<boolean>;
  // Penalty methods
  createPenalty(penaltyData: InsertPenalty & { flatId: string, createdBy: string }): Promise<Penalty>;
  getPenaltiesByFlatId(flatId: string): Promise<Penalty[]>;
  getPenaltiesByUserId(userId: string): Promise<Penalty[]>;
  getPenalty(id: string): Promise<Penalty | undefined>;
  updatePenalty(id: string, data: Partial<Penalty>): Promise<Penalty | undefined>;
  deletePenalty(id: string): Promise<boolean>;
  getPenaltyTotalsByFlatId(flatId: string, userId?: string): Promise<{ userTotal: number; flatTotal: number }>;
  // Penalty Settings methods
  getPenaltySettings(flatId: string): Promise<PenaltySettings | undefined>;
  createPenaltySettings(data: InsertPenaltySettings & { updatedBy: string }): Promise<PenaltySettings>;
  updatePenaltySettings(flatId: string, data: Partial<PenaltySettings>): Promise<PenaltySettings | undefined>;
  // Push notification methods
  addPushSubscription(userId: string, subscription: PushSubscription): Promise<boolean>;
  removePushSubscription(userId: string, endpoint: string): Promise<boolean>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  getPushSubscriptionsByFlatId(flatId: string): Promise<PushSubscription[]>;
  getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]>;
  getPushSubscriptionsByUserIds(userIds: string[]): Promise<PushSubscription[]>;
  getPushSubscriptionsExceptUser(flatId: string, excludedUserId: string): Promise<PushSubscription[]>;
  cleanupPushSubscriptionByEndpoint(endpoint: string): Promise<boolean>;
  sessionStore: session.Store;
}
import type { MongoClient } from 'mongodb';

export class MongoStorage implements IStorage {
  sessionStore: session.Store;
  private client: MongoClient | null = null;

  constructor() {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    this.sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 30 * 24 * 60 * 60, // 30 days
      autoRemove: 'native'
    });

    // Initialize MongoDB client
    mongoose.connection.on('connected', () => {
      this.client = mongoose.connection.getClient();
    });
  }

  async destroySessionsByUserId(userId: string): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('MongoDB client not initialized');
      }

      const db = this.client.db();
      const collection = db.collection('sessions');

      const result = await collection.deleteMany({
        session: new RegExp(`.*"passport":{"user":"${userId}"}.*`)
      });

      // console.log(`Deleted ${result.deletedCount} sessions for user ${userId}`);
    } catch (error) {
      console.error('Error destroying sessions:', error);
      throw error;
    }
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
    const penalties = await PenaltyModel.find({ flatId })
      .populate('userId', 'name email profilePicture')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // console.log('Raw penalties from database:', JSON.stringify(penalties.slice(0, 2)));

    const convertedPenalties = penalties.map(this.convertId);

    return convertedPenalties;
  }
  async getPenaltiesByUserId(userId: string): Promise<Penalty[]> {
    const penalties = await PenaltyModel.find({ userId })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    return penalties.map(this.convertId);
  }

  async getPenalty(id: string): Promise<Penalty | undefined> {
    const penalty = await PenaltyModel.findById(id)
      .populate('userId', 'name email profilePicture')
      .populate('createdBy', 'name')
      .lean();
    return penalty ? this.convertId(penalty) : undefined;
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
    try {
      const result = await PenaltyModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("Failed to delete penalty:", error);
      return false;
    }
  }
  async getPenaltyTotalsByFlatId(flatId: string, userId?: string): Promise<{ userTotal: number; flatTotal: number }> {
    const penalties = await PenaltyModel.find({ flatId }).lean();

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

  convertId<T extends Record<string, any>>(obj: T | null | undefined): T | null | undefined {
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

  async deleteFlat(flatId: string, adminUserId: string): Promise<boolean> {
    try {
      // Get flat info for logging
      const flat = await FlatModel.findById(flatId);
      if (!flat) {
        throw new Error("Flat not found");
      }

      // Get all users in the flat
      const users = await UserModel.find({ flatId });
      console.log(`🗑️ Starting deletion of flat ${flat.name} with ${users.length} users`);

      // Delete all users using the existing deleteUser method
      // This ensures all user cleanup is handled properly with transactions
      let totalUsersDeleted = 0;
      for (const user of users) {
        console.log(`🗑️ Deleting user: ${user.name} (${user.email})`);
        const userDeleted = await this.deleteUser(user._id.toString(), adminUserId);
        if (userDeleted) {
          totalUsersDeleted++;
          console.log(`✅ Successfully deleted user: ${user.name}`);
        } else {
          console.error(`❌ Failed to delete user: ${user.name}`);
          throw new Error(`Failed to delete user: ${user.name}`);
        }
      }
      console.log(`👥 Deleted ${totalUsersDeleted} users using deleteUser method`);

      // Now delete flat-specific data that's not user-related
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Delete all bills for this flat
        const { deletedCount: billsDeleted } = await BillModel.deleteMany({ flatId }).session(session);
        console.log(`🧾 Deleted ${billsDeleted} bills`);

        // Delete penalty settings for this flat
        const { deletedCount: penaltySettingsDeleted } = await PenaltySettingsModel.deleteMany({ flatId }).session(session);
        console.log(`⚙️ Deleted ${penaltySettingsDeleted} penalty settings`);

        // Finally, delete the flat itself
        const result = await FlatModel.findByIdAndDelete(flatId).session(session);
        console.log(`🏠 Deleted flat: ${flat.name}`);

        // Validate complete deletion
        const validation = await this.validateFlatDeletion(flatId, session);
        if (!validation.success) {
          throw new Error(`Flat deletion validation failed: ${validation.errors.join(', ')}`);
        }

        await session.commitTransaction();
        console.log(`✅ Successfully deleted flat ${flat.name} and all related data`);
        return !!result;

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      console.error("Failed to delete flat:", error);
      return false;
    }
  }

  private async validateFlatDeletion(flatId: string, session: mongoose.ClientSession) {
    const errors: string[] = [];

    // Check for any remaining users
    const remainingUsers = await UserModel.countDocuments({ flatId }).session(session);
    if (remainingUsers > 0) {
      errors.push(`Found ${remainingUsers} remaining users`);
    }

    // Check for any remaining entries
    const remainingEntries = await EntryModel.countDocuments({ flatId }).session(session);
    if (remainingEntries > 0) {
      errors.push(`Found ${remainingEntries} remaining entries`);
    }

    // Check for any remaining penalties
    const remainingPenalties = await PenaltyModel.countDocuments({ flatId }).session(session);
    if (remainingPenalties > 0) {
      errors.push(`Found ${remainingPenalties} remaining penalties`);
    }

    // Check for any remaining payments
    const remainingPayments = await PaymentModel.countDocuments({ flatId }).session(session);
    if (remainingPayments > 0) {
      errors.push(`Found ${remainingPayments} remaining payments`);
    }

    // Check for any remaining bills
    const remainingBills = await BillModel.countDocuments({ flatId }).session(session);
    if (remainingBills > 0) {
      errors.push(`Found ${remainingBills} remaining bills`);
    }

    // Check for any remaining penalty settings
    const remainingPenaltySettings = await PenaltySettingsModel.countDocuments({ flatId }).session(session);
    if (remainingPenaltySettings > 0) {
      errors.push(`Found ${remainingPenaltySettings} remaining penalty settings`);
    }

    return {
      success: errors.length === 0,
      errors
    };
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
    const entries = await EntryModel.find({ userId: userId });
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
    const entries = await EntryModel.find({ flatId })
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

  async getBillById(billId: string): Promise<any> {
    const bill = await BillModel.findById(billId);
    return bill ? this.convertId(bill.toObject()) : null;
  }

  async updateBill(billId: string, data: any): Promise<any> {
    const bill = await BillModel.findByIdAndUpdate(billId, { $set: data }, { new: true });
    return bill ? this.convertId(bill.toObject()) : null;
  }

  async deleteBill(billId: string): Promise<boolean> {
    try {
      await PaymentModel.deleteMany({ billId });
      const result = await BillModel.findByIdAndDelete(billId);
      return !!result;
    } catch (err) {
      console.error("deleteBill failed:", err);
      return false;
    }
  }

  async deleteAllBillsByFlatId(flatId: string): Promise<{ deletedBills: number; deletedPayments: number }> {
    try {
      const billIds = await BillModel.find({ flatId }).distinct("_id");
      const paymentsResult = await PaymentModel.deleteMany({ billId: { $in: billIds } });
      const billsResult = await BillModel.deleteMany({ flatId });
      return {
        deletedBills: billsResult.deletedCount ?? 0,
        deletedPayments: paymentsResult.deletedCount ?? 0,
      };
    } catch (err) {
      console.error("deleteAllBillsByFlatId failed:", err);
      return { deletedBills: 0, deletedPayments: 0 };
    }
  }

  async createPayment(data: any): Promise<any> {
    const payment = new PaymentModel(data);
    await payment.save();
    return this.convertId(payment.toObject());
  }

  async getPaymentsByBillId(billId: string): Promise<any[]> {
    const payments = await PaymentModel.find({ billId })
      .populate({ path: 'userId', select: 'name email profilePicture' })
      .sort({ createdAt: 1 });
    return payments.map(payment => {
      const obj = payment.toObject();
      return {
        ...this.convertId(obj),
        userId: obj.userId ? this.convertId(obj.userId as any) : null
      };
    });
  }

  async updatePayment(id: string, data: any): Promise<any> {
    const payment = await PaymentModel.findByIdAndUpdate(id, data, { new: true })
      .populate({ path: 'userId', select: 'name email profilePicture' });
    if (!payment) return null;
    const obj = payment.toObject();
    return {
      ...this.convertId(obj),
      userId: obj.userId ? this.convertId(obj.userId as any) : null
    };
  }

  async getLastPaymentForUser(userId: string, flatId: string): Promise<any> {
    const payment = await PaymentModel.findOne({ userId, flatId }).sort({ createdAt: -1 });
    return payment ? this.convertId(payment.toObject()) : null;
  }

  /**
   * Adjusts the penalty field on the user's latest payment record and recalculates status.
   * amountDelta > 0 = add penalty, < 0 = remove/reduce penalty
   */
  async adjustPaymentPenalty(userId: string, flatId: string, amountDelta: number, billId?: string): Promise<boolean> {
    try {
      // If billId provided, update that specific bill's payment; otherwise fall back to latest payment
      const payment = billId
        ? await PaymentModel.findOne({ billId, userId })
        : await PaymentModel.findOne({ userId, flatId }).sort({ createdAt: -1 });
      if (!payment) return false;

      const newPenalty = Math.max(0, (Number(payment.penalty) || 0) + amountDelta);
      const penaltyWaived = !!payment.penaltyWaived;
      const baseDue = (payment.totalDue != null && Number(payment.totalDue) > 0)
        ? Number(payment.totalDue)
        : Number(payment.amount);
      const effectiveTotal = parseFloat((baseDue + (penaltyWaived ? 0 : newPenalty)).toFixed(2));
      const paidAmount = Number(payment.paidAmount) || 0;
      const newStatus = paidAmount >= effectiveTotal ? "PAID" : "PENDING";

      const updateData: any = { penalty: newPenalty, status: newStatus };
      if (newStatus === "PAID" && !payment.paidAt) {
        updateData.paidAt = new Date();
      } else if (newStatus === "PENDING") {
        updateData.paidAt = null;
      }

      await PaymentModel.findByIdAndUpdate(payment._id, updateData);
      return true;
    } catch (error) {
      console.error("Failed to adjust payment penalty:", error);
      return false;
    }
  }

  /**
   * Returns all APPROVED entries for a flat that have not yet been counted in any bill (billId = null).
   */
  async getUnappliedEntriesByFlatId(flatId: string): Promise<any[]> {
    const entries = await EntryModel.find({ flatId, status: "APPROVED", billId: null });
    return entries.map(e => this.convertId(e.toObject()));
  }

  async getEntriesByBillId(billId: string): Promise<any[]> {
    const entries = await EntryModel.find({ billId, status: "APPROVED" });
    return entries.map(e => this.convertId(e.toObject()));
  }

  /**
   * Marks the given entry IDs as counted in the specified bill.
   */
  async markEntriesAppliedToBill(entryIds: string[], billId: string): Promise<void> {
    if (entryIds.length === 0) return;
    await EntryModel.updateMany({ _id: { $in: entryIds } }, { $set: { billId } });
  }

  /**
   * Returns all penalties for a user/flat that have not yet been applied to any bill (billId = null).
   */
  async getUnappliedPenaltiesForUser(userId: string, flatId: string): Promise<any[]> {
    const penalties = await PenaltyModel.find({ userId, flatId, billId: null });
    return penalties.map(p => this.convertId(p.toObject()));
  }

  /**
   * Marks the given penalty IDs as applied to the specified bill.
   */
  async markPenaltiesAppliedToBill(penaltyIds: string[], billId: string): Promise<void> {
    if (penaltyIds.length === 0) return;
    await PenaltyModel.updateMany({ _id: { $in: penaltyIds } }, { $set: { billId } });
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


  async deleteUser(id: string, reqUserId: string): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await UserModel.findById(id).session(session);
      if (!user) return false;

      const cleanupStats = {
        entries: 0,
        penalties: 0,
        payments: 0,
        activities: 0
      };

      // Delete profile picture
      if (user.profilePicture) {
        try {
          const filePath = path.join(__dirname, '..', user.profilePicture);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.error('Error deleting profile picture:', error);
        }
      }

      // Delete entries (no need to transfer)
      const { deletedCount: entriesDeleted } = await EntryModel.deleteMany({ userId: id }).session(session);
      cleanupStats.entries = entriesDeleted;

      // Delete user's own penalties (penalties assigned TO this user)
      // Do NOT delete penalties created BY this user for others
      const { deletedCount: penaltiesDeleted } = await PenaltyModel.deleteMany({ userId: id }).session(session);
      cleanupStats.penalties = penaltiesDeleted;

      // Delete user's payments
      const { deletedCount: paymentsDeleted } = await PaymentModel.deleteMany({ userId: id }).session(session);
      cleanupStats.payments = paymentsDeleted;

      // Delete user's activities
      const { deletedCount: activitiesDeleted } = await ActivityModel.deleteMany({ userId: id }).session(session);
      cleanupStats.activities = activitiesDeleted;

    // destroy user sessions
      await this.destroySessionsByUserId(id);

      // Remove from penalty settings
      await PenaltySettingsModel.updateMany(
        { selectedUsers: id },
        { $pull: { selectedUsers: id } }
      ).session(session);

     
      // Delete user
      const result = await UserModel.findByIdAndDelete(id).session(session);

      // Validate cleanup
      const validation = await this.validateUserDeletion(id, session);
      if (!validation.success) {
        throw new Error(`User deletion validation failed: ${validation.errors.join(', ')}`);
      }

      await session.commitTransaction();
      return !!result;

    } catch (error) {
      console.error("Failed to delete user:", error);
      await session.abortTransaction();
      return false;
    } finally {
      session.endSession(); // ensures cleanup
    }
  }


  private async validateUserDeletion(userId: string, session: mongoose.ClientSession) {
    const errors: string[] = [];

    // Check for any remaining entries
    const remainingEntries = await EntryModel.countDocuments({ userId }).session(session);
    if (remainingEntries > 0) {
      errors.push(`Found ${remainingEntries} remaining entries`);
    }

    // Check for any remaining payments
    const remainingPayments = await PaymentModel.countDocuments({ userId }).session(session);
    if (remainingPayments > 0) {
      errors.push(`Found ${remainingPayments} remaining payments`);
    }

    // Check for any remaining penalties
    const remainingPenalties = await PenaltyModel.countDocuments({ userId }).session(session);
    if (remainingPenalties > 0) {
      errors.push(`Found ${remainingPenalties} remaining penalties`);
    }
    // Fetch and print all remaining activities for the user
    const remainingActivities = await ActivityModel.find({ userId }).session(session);

    if (remainingActivities.length > 0) {
      errors.push(`Found ${remainingActivities.length} remaining activities`);
    }


    // Check if user still exists in any bills
    const billsWithUser = await BillModel.countDocuments({
      users: userId
    }).session(session);
    if (billsWithUser > 0) {
      errors.push(`Found ${billsWithUser} bills still referencing user`);
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

 

  async updateFlat(flatId: string, update: Partial<Flat>) {
    const updatedFlat = await FlatModel.findByIdAndUpdate(
      flatId,
      { $set: update },
      { new: true }
    ).exec();

    return updatedFlat ? this.convertId(updatedFlat.toObject()) : undefined;
  }

  // Push notification database methods
  async addPushSubscription(userId: string, subscription: PushSubscription): Promise<boolean> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) return false;

      // Check if subscription already exists
      const existingIndex = user.pushSubscriptions.findIndex(
        (sub: any) => sub.endpoint === subscription.endpoint
      );

      if (existingIndex === -1) {
        // Add new subscription
        user.pushSubscriptions.push(subscription);
        await user.save();
        console.log('✅ Push subscription saved to database for user:', userId);
      } else {
        console.log('📱 Push subscription already exists for user:', userId);
      }

      return true;
    } catch (error) {
      console.error("Failed to add push subscription to database:", error);
      return false;
    }
  }

  async removePushSubscription(userId: string, endpoint: string): Promise<boolean> {
    try {
      const result = await UserModel.updateOne(
        { _id: userId },
        { $pull: { pushSubscriptions: { endpoint } } }
      );
      
      console.log('🗑️ Push subscription removed from database for user:', userId);
      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Failed to remove push subscription from database:", error);
      return false;
    }
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    try {
      const users = await UserModel.find({ 
        status: 'ACTIVE', 
        pushSubscriptions: { $exists: true, $ne: [] } 
      });
      
      const subscriptions: PushSubscription[] = [];
      
      users.forEach(user => {
        if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
          user.pushSubscriptions.forEach((sub: any) => {
            subscriptions.push({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            });
          });
        }
      });
      
      console.log(`📱 Retrieved ${subscriptions.length} push subscriptions from database`);
      return subscriptions;
    } catch (error) {
      console.error("Failed to get push subscriptions from database:", error);
      return [];
    }
  }

  async getPushSubscriptionsByFlatId(flatId: string): Promise<PushSubscription[]> {
    try {
      const users = await UserModel.find({ 
        flatId, 
        status: 'ACTIVE',
        pushSubscriptions: { $exists: true, $ne: [] }
      });
      
      const subscriptions: PushSubscription[] = [];
      
      users.forEach(user => {
        if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
          user.pushSubscriptions.forEach((sub: any) => {
            subscriptions.push({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            });
          });
        }
      });
      
      console.log(`📱 Retrieved ${subscriptions.length} push subscriptions for flat ${flatId} from database`);
      return subscriptions;
    } catch (error) {
      console.error("Failed to get push subscriptions by flat ID from database:", error);
      return [];
    }
  }

  async getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
    try {
      const user = await UserModel.findById(userId);
      if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
        return [];
      }

      const subscriptions: PushSubscription[] = [];
      user.pushSubscriptions.forEach((sub: any) => {
        subscriptions.push({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        });
      });

      console.log(`📱 Retrieved ${subscriptions.length} push subscriptions for user ${userId}`);
      return subscriptions;
    } catch (error) {
      console.error("Failed to get push subscriptions for user:", error);
      return [];
    }
  }

  async getPushSubscriptionsByUserIds(userIds: string[]): Promise<PushSubscription[]> {
    try {
      const users = await UserModel.find({ 
        _id: { $in: userIds }, 
        status: 'ACTIVE',
        pushSubscriptions: { $exists: true, $ne: [] }
      });
      
      const subscriptions: PushSubscription[] = [];
      
      users.forEach(user => {
        if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
          user.pushSubscriptions.forEach((sub: any) => {
            subscriptions.push({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            });
          });
        }
      });
      
      console.log(`📱 Retrieved ${subscriptions.length} push subscriptions for ${userIds.length} users`);
      return subscriptions;
    } catch (error) {
      console.error("Failed to get push subscriptions for multiple users:", error);
      return [];
    }
  }

  async getPushSubscriptionsExceptUser(flatId: string, excludedUserId: string): Promise<PushSubscription[]> {
    try {
      const users = await UserModel.find({ 
        flatId,
        _id: { $ne: excludedUserId },
        status: 'ACTIVE',
        pushSubscriptions: { $exists: true, $ne: [] }
      });
      
      const subscriptions: PushSubscription[] = [];
      
      users.forEach(user => {
        if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
          user.pushSubscriptions.forEach((sub: any) => {
            subscriptions.push({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            });
          });
        }
      });
      
      console.log(`📱 Retrieved ${subscriptions.length} push subscriptions for flat ${flatId} (excluding user ${excludedUserId})`);
      return subscriptions;
    } catch (error) {
      console.error("Failed to get push subscriptions except user:", error);
      return [];
    }
  }

  async cleanupPushSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
    try {
      const result = await UserModel.updateMany(
        { 'pushSubscriptions.endpoint': endpoint },
        { $pull: { pushSubscriptions: { endpoint } } }
      );
      
      console.log(`🧹 Cleaned up invalid subscription from ${result.modifiedCount} users`);
      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Failed to cleanup push subscription by endpoint:", error);
      return false;
    }
  }
}

export const storage = new MongoStorage();