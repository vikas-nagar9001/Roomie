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
import { updatePenaltyScheduler } from "./penalty-checker"; // Make sure you import this
import { applyPenaltiesForFlat } from "./penalty-checker";

const penaltyIntervals: Record<string, NodeJS.Timeout> = {}; // Store active intervals per flat




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

  // Bulk delete entries
  app.delete("/api/entries/bulk", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const { entryIds } = req.body;
      if (!Array.isArray(entryIds)) {
        return res.status(400).json({ message: "entryIds must be an array" });
      }

      // Delete all entries and log the activity
      await Promise.all(entryIds.map(id => storage.deleteEntry(id)));

      await storage.logActivity({
        userId: req.user._id,
        type: "ENTRY_DELETED",
        description: `Deleted ${entryIds.length} entries`,
        timestamp: new Date(),
      });

      res.json({ message: "Entries deleted successfully" });
    } catch (error) {
      console.error("Failed to delete entries:", error);
      res.status(500).json({ message: "Failed to delete entries" });
    }
  });

  // Clear user activities
  app.delete("/api/user/activities", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      await storage.clearUserActivities(req.user._id);
      res.json({ message: "Activities cleared successfully" });
    } catch (error) {
      console.error("Failed to clear activities:", error);
      res.status(500).json({ message: "Failed to clear activities" });
    }
  });

  // Delete user
  app.delete("/api/users/:userId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.status(403).json({ message: "Only admins can delete users" });
    }

    try {
      const { userId } = req.params;
      const userToDelete = await storage.getUser(userId);

      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't allow deleting the last admin
      if (userToDelete.role === "ADMIN") {
        const admins = await storage.getUsersByFlatId(req.user.flatId);
        const adminCount = admins.filter(u => u.role === "ADMIN").length;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot delete the last admin" });
        }
      }

      const success = await storage.deleteUser(userId);
      if (success) {
        await storage.logActivity({
          userId: req.user._id,
          type: "USER_DELETED",
          description: `Deleted user ${userToDelete.name} (${userToDelete.email})`,
          timestamp: new Date(),
        });
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete user" });
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
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



  // Move one directory back to reach `Roomie/version.txt`
  const versionFilePath = path.join(__dirname, "..", "version.txt");
  //version.txt set version.txt to new  endpoint
  app.post("/api/set-version-new", (req, res) => {
    try {
      fs.writeFileSync(versionFilePath, "1.5", "utf8");
      console.log("✅ version.txt set to '1.5'");
      res.json({ message: "Version updated to '1.5'. Cache will be cleared on the next request." });
    } catch (error) {
      console.error("❌ Error updating version.txt:", error);
      res.status(500).json({ message: "Failed to update version.txt" });
    }
  });

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

  // Penalties API endpoints
  // Get all penalties for a flat
  app.get("/api/penalties", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const penalties = await storage.getPenaltiesByFlatId(req.user.flatId);
      res.json(penalties);
    } catch (error) {
      console.error("Failed to get penalties:", error);
      res.status(500).json({ message: "Failed to get penalties" });
    }
  });

  // Get penalties total
  app.get("/api/penalties/total", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const totals = await storage.getPenaltyTotalsByFlatId(req.user.flatId, req.user._id);
      res.json(totals);
    } catch (error) {
      console.error("Failed to get penalty totals:", error);
      res.status(500).json({ message: "Failed to get penalty totals" });
    }
  });

  app.get("/api/penalty-timers", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      let settings = await storage.getPenaltySettings(req.user.flatId);

      if (!settings) {
        return res.status(404).json({ error: "Penalty settings not found" });
      }

      res.json({
        lastPenaltyAppliedAt: settings.lastPenaltyAppliedAt,
        warningPeriodDays: settings.warningPeriodDays
      });

    } catch (error) {
      console.error("Error fetching penalty settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get penalty settings
  app.get("/api/penalty-settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      let settings = await storage.getPenaltySettings(req.user.flatId);

      // If no settings exist, create default settings
      if (!settings) {
        settings = await storage.createPenaltySettings({
          flatId: req.user.flatId,
          contributionPenaltyPercentage: 3, // Default 3%
          warningPeriodDays: 3, // Default 3 days
          updatedBy: req.user._id,
          lastPenaltyAppliedAt: new Date(), // ✅ Always set current date
        });
      } else if (!settings.lastPenaltyAppliedAt) {
        // ✅ Ensure existing settings get a valid date
        settings.lastPenaltyAppliedAt = new Date();
        await storage.updateLastPenaltyDate(settings.flatId, settings.lastPenaltyAppliedAt);
      }

      res.json(settings);
    } catch (error) {
      console.error("Failed to get penalty settings:", error);
      res.status(500).json({ message: "Failed to get penalty settings" });
    }
  });


  // Get penalty settings
  app.get("/api/penalty-settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      let settings = await storage.getPenaltySettings(req.user.flatId);

      // If no settings exist, create default settings
      if (!settings) {
        settings = await storage.createPenaltySettings({
          flatId: req.user.flatId,
          contributionPenaltyPercentage: 3, // Default 3%
          warningPeriodDays: 3, // Default 3 days
          updatedBy: req.user._id
        });
      }

      res.json(settings);
    } catch (error) {
      console.error("Failed to get penalty settings:", error);
      res.status(500).json({ message: "Failed to get penalty settings" });
    }
  });

  // Update penalty settings
  app.patch("/api/penalty-settings", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.status(403).json({ message: "Only admins can update penalty settings" });
    }

    try {
      const { contributionPenaltyPercentage, warningPeriodDays, selectedUsers } = req.body;
      const flatId = req.user.flatId;

      // Fetch the current settings
      const currentSettings = await storage.getPenaltySettings(req.user.flatId);

      // Update the settings
      const settings = await storage.updatePenaltySettings(req.user.flatId, {
        contributionPenaltyPercentage: Number(contributionPenaltyPercentage),
        warningPeriodDays: Number(warningPeriodDays),
        selectedUsers: selectedUsers || [], // Add selected users array
        updatedBy: req.user._id,
      });

      // Restart scheduler only if `warningPeriodDays` is changed
      if (currentSettings.warningPeriodDays !== Number(warningPeriodDays)) {
        const now = new Date();
        await storage.updateLastPenaltyDate(flatId, now);
        console.log("Penalty Setting Updated LastAppliedDate updated to "+now)
        await updatePenaltyScheduler(flatId);
      }

      // Log the activity
      await storage.logActivity({
        userId: req.user._id,
        type: "FLAT_MANAGEMENT",
        description: `Updated penalty settings: ${contributionPenaltyPercentage}% penalty, ${warningPeriodDays} days warning period`,
        timestamp: new Date(),
      });

      res.json(settings);
    } catch (error) {
      console.error("Failed to update penalty settings:", error);
      res.status(500).json({ message: "Failed to update penalty settings" });
    }
  });

  // Create a new penalty
  app.post("/api/penalties", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.status(403).json({ message: "Only admins can create penalties" });
    }

    try {
      const { userId, type, amount, description, image } = req.body;

      const penalty = await storage.createPenalty({
        userId,
        type,
        amount: Number(amount),
        description,
        image,
        flatId: req.user.flatId,
        createdBy: req.user._id
      });

      await storage.logActivity({
        userId: req.user._id,
        type: "PENALTY_ADDED",
        description: `Added a ${type} penalty of ₹${amount} to ${userId}`,
        timestamp: new Date(),
      });

      res.status(201).json(penalty);
    } catch (error) {
      console.error("Failed to create penalty:", error);
      res.status(500).json({ message: "Failed to create penalty" });
    }
  });

  // Update a penalty
  app.patch("/api/penalties/:penaltyId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.status(403).json({ message: "Only admins can update penalties" });
    }

    try {
      const { penaltyId } = req.params;
      const { type, amount, description, image } = req.body;

      const updatedPenalty = await storage.updatePenalty(penaltyId, {
        type,
        amount: Number(amount),
        description,
        image
      });

      if (!updatedPenalty) {
        return res.status(404).json({ message: "Penalty not found" });
      }

      await storage.logActivity({
        userId: req.user._id,
        type: "PENALTY_UPDATED",
        description: `Updated penalty ${penaltyId}`,
        timestamp: new Date(),
      });

      res.json(updatedPenalty);
    } catch (error) {
      console.error("Failed to update penalty:", error);
      res.status(500).json({ message: "Failed to update penalty" });
    }
  });

  // Delete a penalty
  app.delete("/api/penalties/:penaltyId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.status(403).json({ message: "Only admins can delete penalties" });
    }

    try {
      const { penaltyId } = req.params;
      const success = await storage.deletePenalty(penaltyId);

      if (!success) {
        return res.status(404).json({ message: "Penalty not found" });
      }

      await storage.logActivity({
        userId: req.user._id,
        type: "PENALTY_DELETED",
        description: `Deleted penalty ${penaltyId}`,
        timestamp: new Date(),
      });

      res.json({ message: "Penalty deleted successfully" });
    } catch (error) {
      console.error("Failed to delete penalty:", error);
      res.status(500).json({ message: "Failed to delete penalty" });
    }
  });

  // Get penalties for a specific user
  app.get("/api/users/:userId/penalties", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const { userId } = req.params;
      const penalties = await storage.getPenaltiesByUserId(userId);
      res.json(penalties);
    } catch (error) {
      console.error("Failed to get user penalties:", error);
      res.status(500).json({ message: "Failed to get user penalties" });
    }
  });

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
    try {
      const entries = await storage.getEntriesByFlatId(req.user.flatId);
      const users = await storage.getUsersByFlatId(req.user.flatId);
      const activeUsers = users.filter(user => user.status === "ACTIVE");

      // Calculate total approved entries for the flat
      const approvedEntries = entries.filter(entry => entry.status === "APPROVED");
      const flatTotal = approvedEntries.reduce((sum, entry) => sum + entry.amount, 0);

      // Calculate user's total approved entries
      const userTotal = approvedEntries
        .filter(entry => {
          const entryUserId = typeof entry.userId === 'object' ? entry.userId._id : entry.userId;
          return entryUserId.toString() === req.user?._id.toString();
        })
        .reduce((sum, entry) => sum + entry.amount, 0);

      // Calculate fair share percentage and amount
      const fairSharePercentage = activeUsers.length > 0 ? 100 / activeUsers.length : 0;
      const fairShareAmount = flatTotal * (fairSharePercentage / 100);

      // Calculate user's contribution percentage
      const userContributionPercentage = flatTotal > 0 ? (userTotal / flatTotal) * 100 : 0;


      res.json({
        userTotal,
        flatTotal,
        userContributionPercentage,
        fairSharePercentage,
        fairShareAmount
      });
    } catch (error) {
      console.error("Error calculating totals:", error);
      res.status(500).json({ message: "Failed to calculate totals" });
    }
  });

  // Check and apply contribution deficit penalties
  app.post("/api/check-contribution-penalties", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.status(403).json({ message: "Only admins can run contribution checks" });
    }
  
    try {
      const flatId = req.user.flatId;
      const flat = await storage.getFlatById(flatId);
      const settings = await storage.getPenaltySettings(flatId);
  
      const deficitUsers = await applyPenaltiesForFlat(flat, settings,'Manual');
  
      res.json({
        message: `Contribution check completed. ${deficitUsers} users penalized.`,
        deficitUsers
      });
    } catch (error) {
      console.error("Failed to check contributions:", error);
      res.status(500).json({ message: "Failed to check contributions" });
    }
  });


  // Check if user can add entry (not exceeding fair share)
  app.get("/api/can-add-entry", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const entries = await storage.getEntriesByFlatId(req.user.flatId);
      const users = await storage.getUsersByFlatId(req.user.flatId);
      const activeUsers = users.filter(user => user.status === "ACTIVE");

      // Calculate total approved entries for the flat
      const approvedEntries = entries.filter(entry => entry.status === "APPROVED");
      const flatTotal = approvedEntries.reduce((sum, entry) => sum + entry.amount, 0);

      // Calculate user's total approved entries
      const userTotal = approvedEntries
        .filter(entry => entry.userId.toString() === req.user?._id.toString())
        .reduce((sum, entry) => sum + entry.amount, 0);

      // Calculate fair share percentage
      const fairSharePercentage = activeUsers.length > 0 ? 100 / activeUsers.length : 0;

      // Calculate user's contribution percentage
      const userContributionPercentage = flatTotal > 0 ? (userTotal / flatTotal) * 100 : 0;

      // Check if user has contributed more than their fair share
      const canAddEntry = userContributionPercentage <= fairSharePercentage || fairSharePercentage === 0;

      res.json({
        canAddEntry,
        userContributionPercentage,
        fairSharePercentage,
        message: canAddEntry ?
          "You can add entries." :
          `You've already contributed ${userContributionPercentage.toFixed(2)}% which exceeds your fair share of ${fairSharePercentage.toFixed(2)}%.`
      });
    } catch (error) {
      console.error("Failed to check if user can add entry:", error);
      res.status(500).json({ message: "Failed to check if user can add entry" });
    }
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

  // Delete entry (soft delete)
  app.delete("/api/entries/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const { id } = req.params;
      const entry = await storage.updateEntry(id, {
        isDeleted: true,
        deletedAt: new Date(),
      });

      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }

      await storage.logActivity({
        userId: req.user._id,
        type: "ENTRY_DELETED",
        description: `Deleted entry: ${entry.name}`,
        timestamp: new Date(),
      });

      res.json(entry);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      res.status(500).json({ message: "Failed to delete entry" });
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
async function checkAndApplyPenalties() {
  try {
    const { checkAndApplyPenalties: penaltyChecker } = await import('./penalty-checker.js');
    return await penaltyChecker();
  } catch (error) {
    console.error('[ERROR] Failed to check and apply penalties:', error);
    throw error;
  }
}

