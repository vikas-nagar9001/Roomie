import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { randomBytes } from "crypto";
import { sendInviteEmail, sendPasswordResetEmail } from "./email";
import { hashPassword } from "./auth";
import multer from "multer";
import path from "path";
import express from 'express';
import { mkdir, existsSync } from 'fs';
import { promisify } from 'util';

const mkdirAsync = promisify(mkdir);
const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads/profiles',
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Create uploads directory if it doesn't exist
  const uploadsDir = './uploads/profiles';
  if (!existsSync(uploadsDir)) {
    mkdirAsync(uploadsDir, { recursive: true }).catch(console.error);
  }

  // Get all users in the flat
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const users = await storage.getUsersByFlatId(req.user.flatId);
    res.json(users);
  });

  // Get user activities
  app.get("/api/user/activities", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const activities = await storage.getUserActivities(req.user._id);
    res.json(activities);
  });

  // Update user profile
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const { name, email } = req.body;
      const updatedUser = await storage.updateUser(req.user._id, { name, email });

      await storage.logActivity({
        userId: req.user._id,
        type: "UPDATE_PROFILE",
        description: "Updated profile information",
        timestamp: new Date()
      });

      res.json(updatedUser);
    } catch (error) {
      console.error('Failed to update profile:', error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Upload profile picture
  app.post("/api/user/profile-picture", upload.single('profilePicture'), async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const profilePicture = `/uploads/profiles/${req.file.filename}`;
      const updatedUser = await storage.updateUser(req.user._id, { profilePicture });

      await storage.logActivity({
        userId: req.user._id,
        type: "UPDATE_PROFILE",
        description: "Updated profile picture",
        timestamp: new Date()
      });

      res.json(updatedUser);
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  // Serve profile pictures
  app.use('/uploads/profiles', express.static('uploads/profiles'));

  // Get all entries
  app.get("/api/entries", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const entries = await storage.getEntriesByFlatId(req.user.flatId);
    res.json(entries);
  });

  // Get total amount for user
  app.get("/api/entries/total", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const total = await storage.getUserEntriesTotal(req.user._id);
    res.json(total);
  });

  // Add entry
  app.post("/api/entries", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    
    try {
      const { name, amount } = req.body;
      const flat = await storage.getFlat(req.user.flatId);
      
      const entry = await storage.createEntry({
        name,
        amount,
        dateTime: new Date(),
        status: amount > (flat.minApprovalAmount || 200) ? "PENDING" : "APPROVED",
        userId: req.user._id,
        flatId: req.user.flatId,
        isDeleted: false
      });

      await storage.logActivity({
        userId: req.user._id,
        type: "ENTRY_ADDED",
        description: `Added entry: ${name} (₹${amount})`,
        timestamp: new Date()
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error('Failed to create entry:', error);
      res.status(500).json({ message: "Failed to create entry" });
    }
  });


  // Invite a new user
  app.post("/api/users/invite", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const { name, email } = req.body;
      const inviteToken = randomBytes(32).toString("hex");
      const inviteExpiry = new Date();
      inviteExpiry.setHours(inviteExpiry.getHours() + 24);

      const user = await storage.createUser({
        name,
        email,
        flatId: req.user.flatId,
        inviteToken,
        inviteExpiry,
        status: "PENDING",
        role: "USER"
      });

      // Send invite email
      await sendInviteEmail(email, name, inviteToken);

      res.status(201).json(user);
    } catch (error) {
      console.error('Failed to invite user:', error);
      res.status(500).json({ message: "Failed to send invite email" });
    }
  });

  // Reset password endpoint
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      const user = await storage.getUserByResetToken(token);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      if (user.resetExpiry && new Date(user.resetExpiry) < new Date()) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      const hashedPassword = await hashPassword(password);
      const updatedUser = await storage.updateUser(user._id, {
        password: hashedPassword,
        resetToken: null,
        resetExpiry: null,
      });

      if (!updatedUser) {
        return res.status(400).json({ message: "Failed to update user" });
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('Failed to reset password:', error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Forgot password
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const resetToken = randomBytes(32).toString("hex");
      const resetExpiry = new Date();
      resetExpiry.setHours(resetExpiry.getHours() + 1);

      await storage.updateUser(user._id, {
        resetToken,
        resetExpiry,
      });

      await sendPasswordResetEmail(email, user.name, resetToken);
      res.sendStatus(200);
    } catch (error) {
      console.error('Failed to process password reset:', error);
      res.status(500).json({ message: "Failed to process password reset" });
    }
  });

  // Update user
  app.patch("/api/users/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);

      if (!user || user.flatId.toString() !== req.user.flatId.toString()) {
        return res.sendStatus(404);
      }

      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error('Failed to update user:', error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Resend invite
  app.post("/api/users/:id/resend-invite", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);

      if (!user || user.flatId.toString() !== req.user.flatId.toString()) {
        return res.sendStatus(404);
      }

      const inviteToken = randomBytes(32).toString("hex");
      const inviteExpiry = new Date();
      inviteExpiry.setHours(inviteExpiry.getHours() + 24);

      const updatedUser = await storage.updateUser(userId, {
        inviteToken,
        inviteExpiry,
        status: "PENDING"
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }

      // Send invite email
      await sendInviteEmail(user.email, user.name, inviteToken);

      res.sendStatus(200);
    } catch (error) {
      console.error('Failed to resend invite:', error);
      res.status(500).json({ message: "Failed to send invite email" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}