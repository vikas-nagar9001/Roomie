import { z } from "zod";

export type Role = "ADMIN" | "CO_ADMIN" | "USER";
export type UserStatus = "PENDING" | "ACTIVE" | "DEACTIVATED";
export type ActivityType = "LOGIN" | "UPDATE_PROFILE" | "CHANGE_PASSWORD" | "FLAT_MANAGEMENT" | "ENTRY_ADDED" | "ENTRY_UPDATED" | "ENTRY_DELETED" | "ENTRY_RESTORED" | "PAYMENT_ADDED" | "PAYMENT_STATUS_UPDATED" | "PENALTY_ADDED" | "PENALTY_UPDATED" | "PENALTY_DELETED";

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
  status: EntryStatus;
  userId: string;
  flatId: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export type PenaltyType = "LATE_PAYMENT" | "DAMAGE" | "RULE_VIOLATION" | "OTHER" | "CONTRIBUTION_DEFICIT";

export interface Penalty {
  _id: string;
  userId: string;
  flatId: string;
  type: PenaltyType;
  amount: number;
  description: string;
  image?: string;
  createdAt: Date;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  nextPenaltyDate?: Date; // Date when the next penalty will be applied if contribution deficit persists
}

// Settings for contribution penalties
export interface PenaltySettings {
  _id: string;
  flatId: string;
  contributionPenaltyPercentage: number; // Percentage of total entry to charge as penalty (default 3%)
  warningPeriodDays: number; // Number of days before applying another penalty (default 3 days)
  updatedAt: Date;
  updatedBy: string;
}

export const insertPenaltySchema = z.object({
  userId: z.string(),
  type: z.enum(["LATE_PAYMENT", "DAMAGE", "RULE_VIOLATION", "OTHER", "CONTRIBUTION_DEFICIT"]),
  amount: z.number().min(0),
  description: z.string().min(1, "Description is required"),
  image: z.string().optional(),
  nextPenaltyDate: z.date().optional(),
});

export const insertPenaltySettingsSchema = z.object({
  flatId: z.string(),
  contributionPenaltyPercentage: z.number().min(0).max(100),
  warningPeriodDays: z.number().min(1),
});

export const insertEntrySchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().min(0),
  dateTime: z.date(),
});

// Define Zod schemas for validation
export const insertFlatSchema = z.object({
  name: z.string().min(1, "Name is required"),
  flatUsername: z.string().min(3).max(50),
});

export const insertUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().optional(),
  flatUsername: z.string().min(3).max(50),
});

export const insertActivitySchema = z.object({
  userId: z.string(),
  type: z.enum(["LOGIN", "UPDATE_PROFILE", "CHANGE_PASSWORD", "FLAT_MANAGEMENT", "ENTRY_ADDED", "ENTRY_UPDATED", "ENTRY_DELETED", "ENTRY_RESTORED", "PAYMENT_ADDED", "PAYMENT_STATUS_UPDATED", "PENALTY_ADDED", "PENALTY_UPDATED", "PENALTY_DELETED"]),
  description: z.string(),
  timestamp: z.date().default(() => new Date()),
});

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
  createdAt: Date;
}

export interface Activity {
  _id: string;
  userId: string;
  type: ActivityType;
  description: string;
  timestamp: Date;
}

export type InsertFlat = z.infer<typeof insertFlatSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertPenalty = z.infer<typeof insertPenaltySchema>;
export type InsertPenaltySettings = z.infer<typeof insertPenaltySettingsSchema>;