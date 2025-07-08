import { z } from "zod";
import mongoose, { Schema, Document } from "mongoose";

export type Role = "ADMIN" | "CO_ADMIN" | "USER";
export type UserStatus = "PENDING" | "ACTIVE" | "DEACTIVATED";
export type ActivityType = "LOGIN" | "UPDATE_PROFILE" | "CHANGE_PASSWORD" | "FLAT_MANAGEMENT" | "ENTRY_ADDED" | "ENTRY_UPDATED" | "ENTRY_DELETED" | "ENTRY_RESTORED" | "PAYMENT_ADDED" | "PAYMENT_STATUS_UPDATED" | "PENALTY_ADDED" | "PENALTY_UPDATED" | "PENALTY_DELETED" | "USER_DELETED";

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface Payment {
  _id: string;
  billId: string;
  userId: string;
  amount: number;
  status: "PAID" | "PENDING";
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
}

export interface Bill {
  _id: string;
  flatId: string;
  month: string;
  year: number;
  items: Array<{
    name: string;
    amount: number;
  }>;
  totalAmount: number;
  splitAmount: number;
  dueDate: Date;
  createdAt: Date;
}

export type EntryStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Entry {
  _id: string;
  name: string;
  amount: number;
  dateTime: Date;
  status: EntryStatus;  userId: string;
  flatId: string;
}

export type PenaltyType = "LATE_PAYMENT" | "DAMAGE" | "RULE_VIOLATION" | "OTHER" | "MINIMUM_ENTRY";

export interface Penalty {
  _id: string;
  userId: string;
  flatId: string;
  type: PenaltyType;
  amount: number;
  description: string;
  image?: string;
  createdAt: Date;  createdBy: string;
  nextPenaltyDate?: Date; // Date when the next penalty will be applied if contribution deficit persists
}


export interface PenaltySettingsDocument extends Document {
  flatId: mongoose.Types.ObjectId;
  contributionPenaltyPercentage: number;
  warningPeriodDays: number;
  updatedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
  lastPenaltyAppliedAt: Date; // Ensure this is included
  selectedUsers: mongoose.Types.ObjectId[]; // Array of user IDs who should receive penalties
}

const PenaltySettingsSchema = new Schema<PenaltySettingsDocument>({
  flatId: { type: mongoose.Schema.Types.ObjectId, required: true },
  contributionPenaltyPercentage: { type: Number, required: true, default: 3 },
  warningPeriodDays: { type: Number, required: true, default: 3 },
  updatedAt: { type: Date, required: true, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  lastPenaltyAppliedAt: { type: Date, default: Date.now }, // ✅ Default value ensures it gets stored
  selectedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs who should receive penalties
});

export const PenaltySettingsModel = mongoose.model<PenaltySettingsDocument>(
  "PenaltySettings",
  PenaltySettingsSchema
);

export const insertPenaltySchema = z.object({
  userId: z.string(),
  type: z.enum(["LATE_PAYMENT", "DAMAGE", "RULE_VIOLATION", "OTHER", "MINIMUM_ENTRY"]),
  amount: z.number().min(0),
  description: z.string().min(1, "Description is required"),
  image: z.string().optional(),
  nextPenaltyDate: z.date().optional(),
});

export const insertPenaltySettingsSchema = z.object({
  flatId: z.string(),
  contributionPenaltyPercentage: z.number().min(0),
  warningPeriodDays: z.number().min(0),
  updatedBy: z.string(),
  selectedUsers: z.array(z.string()).optional()
});

// Define Zod schemas for validation
export const insertFlatSchema = z.object({
  name: z.string().min(1, "Name is required"),
  flatUsername: z.string().min(3).max(50),
});
export type InsertFlat = z.infer<typeof insertFlatSchema>;

export const insertUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().optional(),
  flatUsername: z.string().min(3).max(50),
});
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertActivitySchema = z.object({
  userId: z.string(),
  type: z.enum(["LOGIN", "UPDATE_PROFILE", "CHANGE_PASSWORD", "FLAT_MANAGEMENT", "ENTRY_ADDED", "ENTRY_UPDATED", "ENTRY_DELETED", "ENTRY_RESTORED", "PAYMENT_ADDED", "PAYMENT_STATUS_UPDATED", "PENALTY_ADDED", "PENALTY_UPDATED", "PENALTY_DELETED"]),
  description: z.string(),
  timestamp: z.date().default(() => new Date()),
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Types for TypeScript
export interface Flat {
  _id: string;
  name: string;
  flatUsername: string;
  minApprovalAmount: number;
  paymentSettings: {
    defaultDueDate: number;
    penaltyAmount: number;
    reminderFrequency: number;
    customSplitEnabled: boolean;
  };
}

export interface User {
  _id: string;
  name: string;
  email: string;
  password: string | null;
  role: Role;
  status: UserStatus;
  flatId: string;
  flatUsername?: string;
  profilePicture?: string;
  inviteToken: string | null;
  inviteExpiry: Date | null;
  resetToken: string | null;
  resetExpiry: Date | null;
  pushSubscriptions?: PushSubscription[];
  createdAt: Date;
}

export interface Activity {
  _id: string;
  userId: string;
  type: ActivityType;
  description: string;
  timestamp: Date;
}

// Penalty settings interface for TypeScript type checking
export interface PenaltySettings {
  _id: string;
  flatId: string;
  contributionPenaltyPercentage: number;
  warningPeriodDays: number;
  updatedAt: Date;
  updatedBy: string;
  lastPenaltyAppliedAt: Date;
  selectedUsers: string[];
}

export type InsertPenalty = z.infer<typeof insertPenaltySchema>;
export type InsertPenaltySettings = z.infer<typeof insertPenaltySettingsSchema>;