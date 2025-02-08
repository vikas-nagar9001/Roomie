import { z } from "zod";

export type Role = "ADMIN" | "CO_ADMIN" | "USER";
export type UserStatus = "PENDING" | "ACTIVE" | "DEACTIVATED";

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

// Types for TypeScript
export interface Flat {
  _id: string;
  name: string;
  flatUsername: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  password: string | null;
  role: Role;
  status: UserStatus;
  flatId: string;
  inviteToken: string | null;
  inviteExpiry: Date | null;
  createdAt: Date;
}

export type InsertFlat = z.infer<typeof insertFlatSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;