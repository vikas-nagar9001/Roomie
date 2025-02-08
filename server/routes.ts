import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { randomBytes } from "crypto";
import { sendInviteEmail, sendPasswordResetEmail } from "./email";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Get all users in the flat
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const users = await storage.getUsersByFlatId(req.user.flatId);
    res.json(users);
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