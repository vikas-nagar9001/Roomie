import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { randomBytes } from "crypto";

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
    });

    // In a real app, send an email with the invite link
    // For now, just log it
    console.log(`Invite link: /set-password?token=${inviteToken}`);

    res.status(201).json(user);
  });

  // Update user
  app.patch("/api/users/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    const userId = req.params.id;
    const user = await storage.getUser(userId);

    if (!user || user.flatId !== req.user.flatId) {
      return res.sendStatus(404);
    }

    const updatedUser = await storage.updateUser(userId, req.body);
    res.json(updatedUser);
  });

  // Resend invite
  app.post("/api/users/:id/resend-invite", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    const userId = req.params.id;
    const user = await storage.getUser(userId);

    if (!user || user.flatId !== req.user.flatId) {
      return res.sendStatus(404);
    }

    const inviteToken = randomBytes(32).toString("hex");
    const inviteExpiry = new Date();
    inviteExpiry.setHours(inviteExpiry.getHours() + 24);

    await storage.updateUser(userId, { inviteToken, inviteExpiry });

    // In a real app, send an email with the invite link
    console.log(`Invite link: /set-password?token=${inviteToken}`);

    res.sendStatus(200);
  });

  const httpServer = createServer(app);
  return httpServer;
}