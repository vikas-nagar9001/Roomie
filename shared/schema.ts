import { z } from "zod";

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
  userId: string | { _id: string; name: string; email?: string; profilePicture?: string };
  flatId: string;
  amount: number;           // base split amount per person
  paidAmount: number;       // how much has been received so far
  carryForwardAmount: number; // unpaid balance from previous bill
  entryDeduction: number;   // approved entries deducted from this user's share
  totalDue: number;         // amount + carryForward - entryDeduction (actual amount owed)
  penalty: number;
  penaltyWaived: boolean;
  status: "PAID" | "PENDING";
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
  accountingMonth?: string;
  lifecycleStatus?: "active" | "archived";
  isDeleted?: boolean;
  updatedAt?: Date;
}

export interface Bill {
  _id: string;
  flatId: string;
  month: string;
  year: number;
  items: Array<{
    name: string;
    amount: number;
    members?: string[]; // user IDs — empty or omitted = all members
  }>;
  totalAmount: number;
  splitAmount: number;
  dueDate: Date;
  entryDeductionEnabled: boolean;
  createdAt: Date;
  accountingMonth?: string;
  lifecycleStatus?: "active" | "archived";
  isDeleted?: boolean;
  updatedAt?: Date;
}

/** Per-flat accounting period lock (maps to API `flat-months`). */
export interface FlatMonth {
  _id: string;
  flatId: string;
  monthKey: string;
  /** Same as monthKey ("YYYY-MM"); aligned with ledger accountingMonth. */
  accountingMonth?: string;
  status: "active" | "locked";
  closedAt?: Date;
  closedBy?: string;
  reopenedAt?: Date;
  reopenedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
}

export type EntryStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Entry {
  _id: string;
  name: string;
  amount: number;
  dateTime: Date;
  status: EntryStatus;  userId: string;
  flatId: string;
  billId?: string; // Set when this entry has been counted in a specific bill
  /** Canonical period "YYYY-MM" (calendar month of dateTime). */
  accountingMonth?: string;
  /** Accounting period lifecycle (not approval status). */
  lifecycleStatus?: "active" | "archived";
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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
  /** Month the penalty applies to; accountingMonth is always derived from this (or createdAt). */
  incurredAt?: Date;
  createdAt: Date;  createdBy: string;
  nextPenaltyDate?: Date; // Date when the next penalty will be applied if contribution deficit persists
  billId?: string; // Set when this penalty has been applied to a specific bill
  accountingMonth?: string;
  lifecycleStatus?: "active" | "archived";
  isDeleted?: boolean;
  updatedAt?: Date;
}

export const insertPenaltySchema = z.object({
  userId: z.string(),
  type: z.enum(["LATE_PAYMENT", "DAMAGE", "RULE_VIOLATION", "OTHER", "MINIMUM_ENTRY"]),
  amount: z.number().min(0),
  description: z.string().min(1, "Description is required"),
  image: z.string().optional(),
  nextPenaltyDate: z.date().optional(),
  /** If omitted, server uses current time; accountingMonth is always derived from this. */
  incurredAt: z.coerce.date().optional(),
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
  flatId: z.string().optional(),
  type: z.enum([
    "LOGIN",
    "UPDATE_PROFILE",
    "CHANGE_PASSWORD",
    "FLAT_MANAGEMENT",
    "ENTRY_ADDED",
    "ENTRY_UPDATED",
    "ENTRY_DELETED",
    "ENTRY_RESTORED",
    "PAYMENT_ADDED",
    "PAYMENT_STATUS_UPDATED",
    "PENALTY_ADDED",
    "PENALTY_UPDATED",
    "PENALTY_DELETED",
    "USER_DELETED",
  ]),
  description: z.string(),
  timestamp: z.date().default(() => new Date()),
  read: z.boolean().default(false),
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
  flatId?: string | null;
  type: ActivityType;
  description: string;
  timestamp: Date;
  read: boolean;
  lifecycleStatus?: "active" | "archived";
  isDeleted?: boolean;
}

// Penalty settings interface for TypeScript type checking
export interface PenaltySettings {
  _id: string;
  flatId: string;
  contributionPenaltyPercentage: number;
  warningPeriodDays: number;
  createdAt?: Date;
  updatedAt: Date;
  updatedBy: string;
  lastPenaltyAppliedAt: Date;
  selectedUsers: string[];
  lifecycleStatus?: "active" | "archived";
  isDeleted?: boolean;
}

export type InsertPenalty = z.infer<typeof insertPenaltySchema>;
export type InsertPenaltySettings = z.infer<typeof insertPenaltySettingsSchema>;