import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { randomBytes } from "crypto";
import { sendInviteEmail, sendPasswordResetEmail } from "./email";
import { hashPassword } from "./auth";
import multer from "multer";
import path from "path";
import express from "express";
import { mkdir, existsSync } from "fs";
import { promisify } from "util";
import { fileURLToPath } from "url";
import fs from "fs";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mkdirAsync = promisify(mkdir);
const upload = multer({
  storage: multer.diskStorage({
    destination: "./uploads/profiles",
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Create uploads directory if it doesn't exist
  const uploadsDir = "./uploads/profiles";
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
      const updatedUser = await storage.updateUser(req.user._id, {
        name,
        email,
      });

      await storage.logActivity({
        userId: req.user._id,
        type: "UPDATE_PROFILE",
        description: "Updated profile information",
        timestamp: new Date(),
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Failed to update profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  }); 



  const versionFilePath = path.join(__dirname, "..", "version.txt");

// API to get current version
app.get("/api/version", (req, res) => {
  try {
    if (fs.existsSync(versionFilePath)) {
      const latestVersion = fs.readFileSync(versionFilePath, "utf8").trim();
      res.json({ version: latestVersion });
    } else {
      res.status(404).json({ message: "Version file not found" });
    }
  } catch (error) {
    console.error("❌ Error reading version.txt:", error);
    res.status(500).json({ message: "Server error" });
  }
});

  


  // Upload profile picture
  app.post(
    "/api/user/profile-picture",
    upload.single("profilePicture"),
    async (req, res) => {
      if (!req.user) return res.sendStatus(401);
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });

      try {
        const profilePicture = `/uploads/profiles/${req.file.filename}`;
        const updatedUser = await storage.updateUser(req.user._id, {
          profilePicture,
        });

        await storage.logActivity({
          userId: req.user._id,
          type: "UPDATE_PROFILE",
          description: "Updated profile picture",
          timestamp: new Date(),
        });

        res.json(updatedUser);
      } catch (error) {
        console.error("Failed to upload profile picture:", error);
        res.status(500).json({ message: "Failed to upload profile picture" });
      }
    },
  );

  // Serve profile pictures
  app.use("/uploads/profiles", express.static("uploads/profiles"));

  // Get all entries
  app.get("/api/entries", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const entries = await storage.getEntriesByFlatId(req.user.flatId);
    const users = await storage.getUsersByFlatId(req.user.flatId);

    const entriesWithUsers = await Promise.all(
      entries.map(async (entry) => {
        const user = users.find(
          (u) => u._id.toString() === entry.userId.toString(),
        );
        return {
          ...entry,
          user: user
            ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              profilePicture: user.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s",
            }
            : null,
        };
      }),
    );

    res.json(entriesWithUsers);
  });

  // Get total amount for user
  app.get("/api/entries/total", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const entries = await storage.getEntriesByFlatId(req.user.flatId);
    const userTotal = entries
      .filter(
        (entry) =>
          entry.userId.toString() === req.user?._id.toString() &&
          entry.status === "APPROVED",
      )
      .reduce((sum, entry) => sum + entry.amount, 0);
    const flatTotal = entries
      .filter((entry) => entry.status === "APPROVED")
      .reduce((sum, entry) => sum + entry.amount, 0);
    res.json({ userTotal, flatTotal });
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
        status:
          amount > (flat.minApprovalAmount || 200) ? "PENDING" : "APPROVED",
        userId: req.user._id,
        flatId: req.user.flatId,
        isDeleted: false,
      });

      await storage.logActivity({
        userId: req.user._id,
        type: "ENTRY_ADDED",
        description: `Added entry: ${name} (₹${amount})`,
        timestamp: new Date(),
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Failed to create entry:", error);
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
        role: "USER",
      });

      // Send invite email
      await sendInviteEmail(email, name, inviteToken);

      res.status(201).json(user);
    } catch (error) {
      console.error("Failed to invite user:", error);
      res.status(500).json({ message: "Failed to send invite email" });
    }
  });

  // Reset password endpoint
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      const user = await storage.getUserByResetToken(token);

      if (!user) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset token" });
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

      res.status(200).json({ message: "Password reset successful" });

    } catch (error) {
      console.error("Failed to reset password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Forgot password
  // Get all payments
  app.get("/api/payments", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const payments = await storage.getPaymentsByFlatId(req.user.flatId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Get all bills
  app.get("/api/bills", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const bills = await storage.getBillsByFlatId(req.user.flatId);
      res.json(bills);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  });

  // Create bill
  app.post("/api/bills", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const users = await storage.getUsersByFlatId(req.user.flatId);
      const bill = await storage.createBill({
        ...req.body,
        flatId: req.user.flatId,
        createdAt: new Date()
      });

      // Create payments for each user
      await Promise.all(users.map(user =>
        storage.createPayment({
          billId: bill._id,
          userId: user._id,
          amount: bill.splitAmount,
          dueDate: bill.dueDate,
          flatId: req.user.flatId,
          status: "PENDING"
        })
      ));

      res.status(201).json(bill);
    } catch (error) {
      res.status(500).json({ message: "Failed to create bill" });
    }
  });

  // Update payment status
  app.patch("/api/payments/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const payment = await PaymentModel.findByIdAndUpdate(
        req.params.id,
        {
          status: req.body.status,
          paidAmount: req.body.status === "PAID" ? req.body.amount : 0,
          ...(req.body.status === "PAID" ? { paidAt: new Date() } : { paidAt: null })
        },
        { new: true }
      ).populate('userId', 'name email profilePicture');

      res.json(payment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  // Send payment reminder
  app.post("/api/payments/:id/remind", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const payment = await PaymentModel.findById(req.params.id)
        .populate("userId", "email name");

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // TODO: Implement email reminder
      // await sendPaymentReminder(payment.userId.email, payment.userId.name, payment.amount);

      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

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
      console.error("Failed to process password reset:", error);
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
      console.error("Failed to update user:", error);
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
        status: "PENDING",
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }

      // Send invite email
      await sendInviteEmail(user.email, user.name, inviteToken);

      res.sendStatus(200);
    } catch (error) {
      console.error("Failed to resend invite:", error);
      res.status(500).json({ message: "Failed to send invite email" });
    }
  });

  // Update entry
  app.patch("/api/entries/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const { id } = req.params;
      const entry = await storage.updateEntry(id, req.body);
      res.json(entry);
    } catch (error) {
      console.error("Failed to update entry:", error);
      res.status(500).json({ message: "Failed to update entry" });
    }
  });

  // Approve/Decline entry
  app.post("/api/entries/:id/:action", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const { id, action } = req.params;
      const entry = await storage.updateEntry(id, {
        status: action.toUpperCase(),
      });
      res.json(entry);
    } catch (error) {
      console.error("Failed to update entry status:", error);
      res.status(500).json({ message: "Failed to update entry status" });
    }
  });

  // Payment Settings Routes
  app.put("/api/payment-settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const flat = await storage.updateFlat(req.user.flatId, { paymentSettings: req.body });
      res.json(flat.paymentSettings);
    } catch (err) {
      res.status(500).json({ error: "Failed to update payment settings" });
    }
  });

  app.get("/api/payment-settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const flat = await storage.getFlat(req.user.flatId);
      res.json(flat.paymentSettings);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch payment settings" });
    }
  });


  // Update flat payment settings
  app.patch("/api/flat/settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const flat = await storage.updateFlat(req.user.flatId, {
        paymentSettings: req.body
      });
      res.json(flat);
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Update payment penalty
  app.patch("/api/payments/:id/penalty", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const payment = await PaymentModel.findByIdAndUpdate(
        req.params.id,
        { penaltyWaived: req.body.waived },
        { new: true }
      );
      res.json(payment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update penalty" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}