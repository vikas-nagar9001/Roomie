import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, PaymentModel, BillModel } from "./storage";
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
import { clearPenaltyInterval } from "./penalty-checker";
import { PushNotificationService } from "./push-notification-service";
import mongoose from "mongoose";

// ─── MonthlyHistory Model (seeded summary data) ───────────────────────────────
const _memberEntrySchema = new mongoose.Schema({
  name:          String,
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  entryAmount:   { type: Number, default: 0 },
  penaltyAmount: { type: Number, default: 0 },
  netAmount:     { type: Number, default: 0 },
});
const _monthlyHistorySchema = new mongoose.Schema({
  flatId:     { type: mongoose.Schema.Types.ObjectId, ref: "Flat", required: true },
  month:      String,
  year:       Number,
  monthIndex: Number,
  members:    [_memberEntrySchema],
  grandTotal: { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now },
});
const MonthlyHistoryModel =
  mongoose.models["MonthlyHistory"] ??
  mongoose.model("MonthlyHistory", _monthlyHistorySchema);

// ─── Standalone snapshot helper (also used by penalty-checker auto-snapshot) ──
const _MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export async function snapshotMonthForFlat(flatId: string, year: number, monthIndex: number) {
  const startOfMonth = new Date(year, monthIndex, 1);
  const endOfMonth   = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const [allEntries, allPenalties, users] = await Promise.all([
    storage.getEntriesByFlatId(flatId),
    storage.getPenaltiesByFlatId(flatId),
    storage.getUsersByFlatId(flatId),
  ]);

  const entries   = allEntries.filter(e => {
    const d = new Date(e.dateTime || e.createdAt);
    return d >= startOfMonth && d <= endOfMonth && e.status === "APPROVED";
  });
  const penalties = allPenalties.filter(p => {
    const d = new Date(p.createdAt);
    return d >= startOfMonth && d <= endOfMonth;
  });

  const memberMap: Record<string, { name: string; userId: any; entryAmount: number; penaltyAmount: number }> = {};
  for (const u of users) {
    memberMap[u._id.toString()] = { name: u.name, userId: u._id, entryAmount: 0, penaltyAmount: 0 };
  }
  for (const e of entries) {
    const uid = typeof e.userId === "object" ? ((e.userId as any)._id ?? e.userId).toString() : e.userId.toString();
    if (!memberMap[uid]) memberMap[uid] = { name: (e.userId as any)?.name ?? "Unknown", userId: uid, entryAmount: 0, penaltyAmount: 0 };
    memberMap[uid].entryAmount += e.amount;
  }
  for (const p of penalties) {
    const uid = typeof p.userId === "object" ? ((p.userId as any)._id ?? p.userId).toString() : p.userId.toString();
    if (!memberMap[uid]) memberMap[uid] = { name: (p.userId as any)?.name ?? "Unknown", userId: uid, entryAmount: 0, penaltyAmount: 0 };
    memberMap[uid].penaltyAmount += p.amount;
  }

  const members = Object.values(memberMap).map(m => ({
    name: m.name, userId: m.userId,
    entryAmount: m.entryAmount, penaltyAmount: m.penaltyAmount,
    netAmount: m.entryAmount - m.penaltyAmount,
  }));
  const grandTotal = members.reduce((s, m) => s + m.entryAmount, 0);

  return MonthlyHistoryModel.findOneAndUpdate(
    { flatId, year, monthIndex },
    { flatId, month: _MONTH_NAMES[monthIndex], year, monthIndex, members, grandTotal, createdAt: new Date() },
    { upsert: true, new: true }
  );
}

function memberUserIdString(m: { userId?: unknown }): string | null {
  const u = m?.userId as { _id?: unknown } | string | undefined;
  if (u == null) return null;
  if (typeof u === "string") return u;
  const id = (u as { _id?: unknown })._id ?? u;
  return id != null ? String(id) : null;
}

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

  // Get users in the flat except pending users
  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const users = await storage.getUsersByFlatId(req.user.flatId);
    res.json(users);
  });

  // Get all users include pending users
  app.get("/api/allUsers", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const users = await storage.getAllUsersByFlatId(req.user.flatId);
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

  // Mark single activity as read
  app.patch("/api/user/activities/:id/read", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      await storage.markActivityRead(req.user._id, req.params.id);
      res.json({ message: "Activity marked as read" });
    } catch (error) {
      console.error("Failed to mark activity as read:", error);
      res.status(500).json({ message: "Failed to mark activity as read" });
    }
  });

  // Mark all activities as read
  app.post("/api/user/activities/read-all", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      await storage.markAllActivitiesRead(req.user._id);
      res.json({ message: "All activities marked as read" });
    } catch (error) {
      console.error("Failed to mark all activities as read:", error);
      res.status(500).json({ message: "Failed to mark all activities as read" });
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

      const success = await storage.deleteUser(userId,req.user._id);
      if (success) {
        // Send push notification to all remaining users in the flat
        try {
          const pushService = new PushNotificationService(req.user.flatId);
          await pushService.pushToAllUsersExcept(
            "👋 User Removed",
            `${userToDelete.name} has been removed from the flat by admin.`,
            userId // Exclude the deleted user since they won't receive it anyway
          );
        } catch (notificationError) {
          console.error("Failed to send user deletion notification:", notificationError);
          // Don't fail the deletion if notification fails
        }

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

  // ─── History API ──────────────────────────────────────────────────────────
  // GET /api/history — unified history: entries + penalties for the flat
  app.get("/api/history", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const [entries, penalties] = await Promise.all([
        storage.getEntriesByFlatId(req.user.flatId),
        storage.getPenaltiesByFlatId(req.user.flatId),
      ]);
      res.json({ entries, penalties });
    } catch (error) {
      console.error("Failed to get history:", error);
      res.status(500).json({ message: "Failed to get history" });
    }
  });

  // GET /api/monthly-history — seeded historical monthly summaries
  app.get("/api/monthly-history", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const records = await MonthlyHistoryModel.find({ flatId: req.user.flatId })
        .sort({ year: -1, monthIndex: -1 })
        .lean();
      res.json(records);
    } catch (error) {
      console.error("Failed to get monthly history:", error);
      res.status(500).json({ message: "Failed to get monthly history" });
    }
  });

  // GET /api/monthly-history/backup — CSV download of all (or year-filtered) monthly history
  app.get("/api/monthly-history/backup", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") return res.sendStatus(403);
    try {
      const yearFilter = req.query.year ? Number(req.query.year) : null;
      const query: any = { flatId: req.user.flatId };
      if (yearFilter && !isNaN(yearFilter)) query.year = yearFilter;
      const records = await MonthlyHistoryModel.find(query)
        .sort({ year: 1, monthIndex: 1 })
        .lean() as any[];
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const row = (...cols: unknown[]) => cols.map(esc).join(",");
      const lines: string[] = [row("Month", "Year", "Member", "Entry Amount", "Penalty Amount", "Net Amount", "Grand Total")];
      for (const rec of records) {
        const members: any[] = rec.members || [];
        if (members.length === 0) {
          lines.push(row(rec.month, rec.year, "", "", "", "", rec.grandTotal));
        } else {
          members.forEach((m, i) => {
            lines.push(row(rec.month, rec.year, m.name, m.entryAmount, m.penaltyAmount, m.netAmount ?? (m.entryAmount - m.penaltyAmount), i === 0 ? rec.grandTotal : ""));
          });
        }
      }
      const suffix = yearFilter ? `-${yearFilter}` : "";
      const filename = `roomie-history-backup${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(lines.join("\r\n"));
    } catch (error) {
      console.error("Failed to backup monthly history:", error);
      res.status(500).json({ message: "Failed to backup" });
    }
  });

  // DELETE /api/monthly-history/all — delete all history for this flat
  app.delete("/api/monthly-history/all", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") return res.sendStatus(403);
    try {
      const result = await MonthlyHistoryModel.deleteMany({ flatId: req.user.flatId });
      res.json({ deleted: result.deletedCount });
    } catch (error) {
      console.error("Failed to delete all monthly history:", error);
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // DELETE /api/monthly-history/year/:year — delete all months for a given year
  app.delete("/api/monthly-history/year/:year", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") return res.sendStatus(403);
    try {
      const year = Number(req.params.year);
      if (isNaN(year)) return res.status(400).json({ message: "Invalid year" });
      const result = await MonthlyHistoryModel.deleteMany({ flatId: req.user.flatId, year });
      res.json({ deleted: result.deletedCount });
    } catch (error) {
      console.error("Failed to delete year history:", error);
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // DELETE /api/monthly-history/:id — delete a single month record
  app.delete("/api/monthly-history/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") return res.sendStatus(403);
    try {
      const record = await MonthlyHistoryModel.findOneAndDelete({ _id: req.params.id, flatId: req.user.flatId });
      if (!record) return res.status(404).json({ message: "Record not found" });
      res.json({ deleted: 1 });
    } catch (error) {
      console.error("Failed to delete monthly history record:", error);
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // POST /api/monthly-history/snapshot — compute & save a month summary
  // Body: { year?: number, monthIndex?: number }  (defaults to previous calendar month)
  app.post("/api/monthly-history/snapshot", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") return res.sendStatus(403);
    try {
      const now = new Date();
      const targetYear  = req.body.year       != null ? Number(req.body.year)       : (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
      const targetMonth = req.body.monthIndex != null ? Number(req.body.monthIndex) : (now.getMonth() === 0 ? 11 : now.getMonth() - 1);

      const record = await snapshotMonthForFlat(req.user.flatId, targetYear, targetMonth);
      res.json({ message: `Snapshot saved for ${_MONTH_NAMES[targetMonth]} ${targetYear}`, record });
    } catch (error) {
      console.error("Failed to create monthly history snapshot:", error);
      res.status(500).json({ message: "Failed to create snapshot" });
    }
  });

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
          contributionPenaltyPercentage: 0, // Default 3%
          warningPeriodDays: 0, // Default 3 days
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
        console.log("Penalty Setting Updated LastAppliedDate updated to " + now)
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
      const { userId, type, amount, description, image, adminMessage } = req.body;

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
        description: `Added a ${type} penalty of ₹${amount} to ${(await storage.getUser(String(userId)))?.name ?? userId}`,
        timestamp: new Date(),
      });

      // New penalty has billId=null — it will be picked up automatically when the next bill is generated

      // �📢 Send notification to the penalized user
      try {
        const notificationService = new PushNotificationService(req.user.flatId);
        await notificationService.notifyPenaltyApplied(
          { id: userId }, 
          { desc: description, amount: Number(amount), type }
        );

        // ⚠️ Check and notify users with low contribution warnings after penalty applied
        setTimeout(async () => {
          try {
            await notificationService.checkAndNotifyLowContributionWarnings();
            console.log(`✅ Warning check completed after penalty applied by ${req.user?.name || 'Unknown user'}`);
          } catch (warningError) {
            console.error("Failed to check low contribution warnings after penalty applied:", warningError);
          }
        }, 1000); // Small delay to ensure penalty is fully processed

      } catch (notificationError) {
        console.error("Failed to send penalty notification:", notificationError);
        // Don't fail the request if notification fails
      }

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

      // Get the original penalty to know the old amount and user
      const originalPenalty = await storage.getPenalty(penaltyId);
      if (!originalPenalty) {
        return res.status(404).json({ message: "Penalty not found" });
      }

      const updatedPenalty = await storage.updatePenalty(penaltyId, {
        type,
        amount: Number(amount),
        description,
        image
      });

      if (!updatedPenalty) {
        return res.status(404).json({ message: "Penalty not found" });
      }

      // 🔗 Adjust payment penalty only if this penalty was already applied to a specific bill
      try {
        const penaltyUserId = typeof originalPenalty.userId === 'object' && originalPenalty.userId !== null
          ? (originalPenalty.userId as any)._id?.toString() ?? String(originalPenalty.userId)
          : String(originalPenalty.userId);
        const delta = Number(amount) - Number(originalPenalty.amount);
        if (delta !== 0 && originalPenalty.billId) {
          await storage.adjustPaymentPenalty(penaltyUserId, req.user.flatId, delta, String(originalPenalty.billId));
        }
      } catch (syncErr) {
        console.warn("Failed to sync penalty update to payment record:", syncErr);
      }

      await storage.logActivity({
        userId: req.user._id,
        type: "PENALTY_UPDATED",
        description: `Updated ${updatedPenalty.type} penalty of ₹${updatedPenalty.amount} for ${(await storage.getUser(String(updatedPenalty.userId)))?.name ?? String(updatedPenalty.userId)}`,
        timestamp: new Date(),
      });

      // Send penalty edited notification
      try {
        const { PushNotificationService } = await import('./push-notification-service.js');
        const notificationService = new PushNotificationService(updatedPenalty.flatId);
        await notificationService.notifyPenaltyEdited(
          { id: updatedPenalty.userId },
          { 
            desc: updatedPenalty.description || 'Penalty',
            amount: updatedPenalty.amount,
            oldAmount: originalPenalty.amount
          }
        );

        // ⚠️ Check and notify users with low contribution warnings after penalty updated
        setTimeout(async () => {
          try {
            await notificationService.checkAndNotifyLowContributionWarnings();
            console.log(`✅ Warning check completed after penalty updated by ${req.user?.name || 'Unknown user'}`);
          } catch (warningError) {
            console.error("Failed to check low contribution warnings after penalty updated:", warningError);
          }
        }, 1000); // Small delay to ensure penalty is fully processed

      } catch (notifError) {
        console.error('Failed to send penalty edited notification:', notifError);
      }

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
      
      // Get the penalty details before deleting to send notification
      const penalty = await storage.getPenalty(penaltyId);
      if (!penalty) {
        return res.status(404).json({ message: "Penalty not found" });
      }

      const success = await storage.deletePenalty(penaltyId);

      if (!success) {
        return res.status(404).json({ message: "Penalty not found" });
      }

      // 🔗 Reverse penalty amount only if this penalty was already applied to a specific bill
      try {
        const penaltyUserId = typeof penalty.userId === 'object' && penalty.userId !== null
          ? (penalty.userId as any)._id?.toString() ?? String(penalty.userId)
          : String(penalty.userId);
        if (penalty.billId) {
          await storage.adjustPaymentPenalty(penaltyUserId, req.user.flatId, -Number(penalty.amount), String(penalty.billId));
        }
      } catch (syncErr) {
        console.warn("Failed to sync penalty deletion to payment record:", syncErr);
      }

      await storage.logActivity({
        userId: req.user._id,
        type: "PENALTY_DELETED",
        description: `Removed ${penalty.type} penalty of ₹${penalty.amount} for ${(await storage.getUser(String(penalty.userId)))?.name ?? String(penalty.userId)}`,
        timestamp: new Date(),
      });

      // Send penalty deleted notification
      try {
        const { PushNotificationService } = await import('./push-notification-service.js');
        const notificationService = new PushNotificationService(penalty.flatId);
        await notificationService.notifyPenaltyDeleted(
          { id: penalty.userId },
          { 
            desc: penalty.description || 'Penalty',
            amount: penalty.amount
          }
        );

        // ⚠️ Check and notify users with low contribution warnings after penalty deleted
        setTimeout(async () => {
          try {
            await notificationService.checkAndNotifyLowContributionWarnings();
            console.log(`✅ Warning check completed after penalty deleted by ${req.user?.name || 'Unknown user'}`);
          } catch (warningError) {
            console.error("Failed to check low contribution warnings after penalty deleted:", warningError);
          }
        }, 1000); // Small delay to ensure penalty is fully processed

      } catch (notifError) {
        console.error('Failed to send penalty deleted notification:', notifError);
      }

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
              profilePicture: user.profilePicture 
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
      const approvedEntries = entries.filter(entry => entry && entry.status === "APPROVED");
      const flatTotal = approvedEntries.reduce((sum, entry) => entry ? sum + entry.amount : sum, 0);

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

      const deficitUsers = await applyPenaltiesForFlat(flat, settings, 'Manual');

      // 📢 Send notification to admin about penalty completion
      if (deficitUsers > 0) {
        try {
          const notificationService = new PushNotificationService(req.user.flatId);
          await notificationService.sendFlatAnnouncement(
            `⚖️ Manual penalty check completed. ${deficitUsers} user(s) have been penalized for insufficient contribution. Check penalties section for details.`
          );
        } catch (notificationError) {
          console.error("Failed to send penalty completion notification:", notificationError);
          // Don't fail the request if notification fails
        }
      }

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
      const approvedEntries = entries.filter(entry => entry && entry.status === "APPROVED");
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
        dateTime: new Date(),        status:
          amount > (flat.minApprovalAmount || 200) ? "PENDING" : "APPROVED",
        userId: req.user._id,
        flatId: req.user.flatId,
      });

      await storage.logActivity({
        userId: req.user._id,
        type: "ENTRY_ADDED",
        description: `Added entry: ${name} (₹${amount})`,
        timestamp: new Date(),
      });

      // 📢 Send notification to other users about new entry
      try {
        const notificationService = new PushNotificationService(req.user.flatId);
        await notificationService.notifyEntryAdded(
          { id: req.user._id, name: req.user.name }, 
          { name, amount }
        );

        // ⚠️ Check and notify users with low contribution warnings after entry addition
        setTimeout(async () => {
          try {
            await notificationService.checkAndNotifyLowContributionWarnings();
            console.log(`✅ Warning check completed after entry addition by ${req.user.name}`);
          } catch (warningError) {
            console.error("Failed to check low contribution warnings after entry addition:", warningError);
          }
        }, 1000); // Small delay to ensure entry is fully processed

      } catch (notificationError) {
        console.error("Failed to send entry added notification:", notificationError);
        // Don't fail the request if notification fails
      }

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

  // Get all bills (with payment status: Paid if all users paid in full, Pending if any has remaining)
  app.get("/api/bills", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const bills = await storage.getBillsByFlatId(req.user.flatId);
      const withStatus = await Promise.all(bills.map(async (bill: any) => {
        const payments = await storage.getPaymentsByBillId(bill._id);
        let paymentStatus: "Paid" | "Pending" = "Paid";
        for (const p of payments) {
          const baseDue = (p.totalDue != null && p.totalDue > 0) ? p.totalDue : p.amount;
          const penalty = p.penaltyWaived ? 0 : (Number(p.penalty) || 0);
          const effectiveTotal = baseDue + penalty;
          const paid = Number(p.paidAmount) || 0;
          if (paid < effectiveTotal) {
            paymentStatus = "Pending";
            break;
          }
        }
        return { ...bill, paymentStatus };
      }));
      res.json(withStatus);
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
      const { items, totalAmount, month, year, dueDate, entryDeductionEnabled } = req.body;
      const flatId = req.user.flatId;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one expense item is required" });
      }
      const total = Number(totalAmount);
      if (isNaN(total) || total <= 0) {
        return res.status(400).json({ message: "Invalid total amount" });
      }
      const due = dueDate ? new Date(dueDate) : new Date();
      if (isNaN(due.getTime())) {
        return res.status(400).json({ message: "Invalid due date" });
      }

      const users = await storage.getUsersByFlatId(flatId);
      if (users.length === 0) {
        return res.status(400).json({ message: "No active users found in flat" });
      }

      // Helper: calculate per-user share from items with optional member lists
      const calcUserShare = (userId: string, parsedItems: Array<{name: string; amount: number; members: string[]}>) => {
        let share = 0;
        for (const item of parsedItems) {
          const mems = item.members || [];
          const isIncluded = mems.length === 0 || mems.map(String).includes(String(userId));
          if (!isIncluded) continue;
          const count = mems.length === 0 ? users.length : mems.length;
          share += item.amount / count;
        }
        return parseFloat(share.toFixed(2));
      };

      const splitAmount = parseFloat((total / users.length).toFixed(2)); // average for display
      const monthStr = month || due.toLocaleString("default", { month: "long" });
      const yearNum = year != null ? Number(year) : due.getFullYear();

      // Parse items with members
      const parsedItems: Array<{name: string; amount: number; members: string[]}> = items.map((i: { name: string; amount: number; members?: string[] }) => ({
        name: String(i.name || "").trim(),
        amount: Number(i.amount) || 0,
        members: Array.isArray(i.members) ? i.members.map(String) : []
      }));

      let billMonthIndex = _MONTH_NAMES.indexOf(monthStr);
      if (billMonthIndex < 0) billMonthIndex = due.getMonth();

      // Optional: which MonthlyHistory row to use (defaults to same month/year as the bill)
      let historyYear = req.body.historyYear != null && req.body.historyYear !== ""
        ? Number(req.body.historyYear)
        : undefined;
      let historyMonthIndex = req.body.historyMonthIndex != null && req.body.historyMonthIndex !== ""
        ? Number(req.body.historyMonthIndex)
        : undefined;
      // Default: same calendar month as the bill (current month’s monthly history snapshot)
      if (historyYear == null || isNaN(historyYear) || historyMonthIndex == null || isNaN(historyMonthIndex)) {
        historyYear = yearNum;
        historyMonthIndex = billMonthIndex;
      }

      const userEntryMap: Record<string, number> = {};
      const userEntryIds: Record<string, string[]> = {};
      const userPenaltyMap: Record<string, number> = {};
      let totalEntriesAmount = 0;
      let usedMonthlyHistorySnapshot = false;

      if (entryDeductionEnabled !== false) {
        try {
          const snapshot = await MonthlyHistoryModel.findOne({
            flatId,
            year: historyYear,
            monthIndex: historyMonthIndex,
          }).lean() as any;

          if (snapshot && Array.isArray(snapshot.members) && snapshot.members.length > 0) {
            usedMonthlyHistorySnapshot = true;
            for (const m of snapshot.members) {
              const uid = memberUserIdString(m);
              if (!uid) continue;
              const entryAmt = Number(m.entryAmount) || 0;
              const penAmt = Number(m.penaltyAmount) || 0;
              userEntryMap[uid] = (userEntryMap[uid] || 0) + entryAmt;
              userPenaltyMap[uid] = (userPenaltyMap[uid] || 0) + penAmt;
              totalEntriesAmount += entryAmt;
            }
          }
        } catch (histErr) {
          console.warn("Monthly history lookup failed:", histErr);
        }

        // Fallback: legacy behaviour — live unapplied entries + penalties collections
        if (!usedMonthlyHistorySnapshot) {
          try {
            const unappliedEntries = await storage.getUnappliedEntriesByFlatId(flatId);
            for (const entry of unappliedEntries || []) {
              const uid = (entry.userId?._id ?? entry.userId)?.toString?.() ?? String(entry.userId);
              const amt = Number(entry.amount) || 0;
              if (uid && amt > 0) {
                userEntryMap[uid] = (userEntryMap[uid] || 0) + amt;
                if (!userEntryIds[uid]) userEntryIds[uid] = [];
                userEntryIds[uid].push(String(entry._id));
                totalEntriesAmount += amt;
              }
            }
          } catch (entryErr) {
            console.warn("Entry fetch failed, continuing without:", entryErr);
          }
        }

        if (totalEntriesAmount > 0) {
          const filtered = parsedItems.filter(i => i.name.toLowerCase() !== "entries");
          filtered.push({ name: "Entries", amount: totalEntriesAmount, members: [] });
          parsedItems.length = 0;
          parsedItems.push(...filtered);
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Recalculate total and split with entries included
      const finalTotal = parsedItems.reduce((s, i) => s + i.amount, 0);
      const finalSplit = parseFloat((finalTotal / users.length).toFixed(2));

      const bill = await storage.createBill({
        items: parsedItems,
        totalAmount: finalTotal,
        splitAmount: finalSplit,
        month: monthStr,
        year: yearNum,
        dueDate: due,
        flatId,
        entryDeductionEnabled: entryDeductionEnabled !== false,
        createdAt: new Date()
      });

      // userEntryMap and userEntryIds already populated above

      const payments = [];
      const allAppliedPenaltyIds: string[] = [];
      const allAppliedEntryIds: string[] = [];

      for (const user of users) {
        const uid = (user._id && typeof user._id === "string") ? user._id : String(user._id);

        let carryForwardAmount = 0;
        try {
          const lastPayment = await storage.getLastPaymentForUser(uid, flatId);
          const prevTotalDue = lastPayment ? (Number(lastPayment.totalDue) > 0 ? Number(lastPayment.totalDue) : Number(lastPayment.amount)) : 0;
          const prevPaid = lastPayment ? (Number(lastPayment.paidAmount) || 0) : 0;
          carryForwardAmount = parseFloat(Math.max(0, prevTotalDue - prevPaid).toFixed(2));
        } catch (e) {
          console.warn("Carry-forward lookup failed for user", uid, e);
        }

        let initialPenalty = 0;
        const userPenaltyIds: string[] = [];
        if (usedMonthlyHistorySnapshot) {
          initialPenalty = parseFloat((userPenaltyMap[uid] || 0).toFixed(2));
        } else {
          try {
            const unappliedPenalties = await storage.getUnappliedPenaltiesForUser(uid, flatId);
            for (const p of unappliedPenalties) {
              initialPenalty += Number(p.amount) || 0;
              userPenaltyIds.push(String(p._id));
            }
            initialPenalty = parseFloat(initialPenalty.toFixed(2));
          } catch (e) {
            console.warn("Unapplied penalty lookup failed for user", uid, e);
          }
        }

        const entryDeduction = parseFloat((userEntryMap[uid] || 0).toFixed(2));
        const userBaseAmount = calcUserShare(uid, parsedItems);
        const totalDue = parseFloat(Math.max(0, userBaseAmount + carryForwardAmount - entryDeduction).toFixed(2));
        const effectiveTotal = parseFloat((totalDue + initialPenalty).toFixed(2));

        const payment = await storage.createPayment({
          billId: bill._id,
          userId: user._id,
          flatId,
          amount: userBaseAmount,
          paidAmount: 0,
          carryForwardAmount,
          entryDeduction,
          totalDue,
          penalty: initialPenalty,
          status: effectiveTotal === 0 ? "PAID" : "PENDING",
          dueDate: due,
        });
        payments.push(payment);

        allAppliedPenaltyIds.push(...userPenaltyIds);
        allAppliedEntryIds.push(...(userEntryIds[uid] || []));
      }

      // Mark entries and penalties as applied to this bill so they aren't counted again
      try {
        await storage.markEntriesAppliedToBill(allAppliedEntryIds, String(bill._id));
        await storage.markPenaltiesAppliedToBill(allAppliedPenaltyIds, String(bill._id));
      } catch (markErr) {
        console.warn("Failed to mark entries/penalties as applied to bill:", markErr);
      }

      try {
        await storage.logActivity({
          userId: req.user._id,
          type: "PAYMENT_ADDED",
          description: `Created bill for ${monthStr} ${yearNum} — ₹${total} (₹${splitAmount}/person)`,
          timestamp: new Date(),
        });
      } catch (logErr) {
        console.warn("Activity log failed:", logErr);
      }

      try {
        const pushService = new PushNotificationService(flatId);
        const dueStr = due ? due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : undefined;
        await pushService.notifyNewBillCreated(monthStr, yearNum, total, dueStr, bill._id?.toString?.());
      } catch (pushErr) {
        console.warn("New bill notification failed:", pushErr);
      }

      res.status(201).json({ ...bill, payments });
    } catch (error: any) {
      console.error("Failed to create bill:", error);
      const msg = error?.message || "Failed to create bill";
      res.status(500).json({ message: msg });
    }
  });

  // Import historical bills from sheet data (admin only) — exact values, no recalculation
  app.post("/api/bills/import", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }
    const normalize = (s: string) => s.replace(/[^\w\s]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    const firstWord = (s: string) => (s.split(/\s+/)[0] || "").toLowerCase();
    const matchUser = (userName: string, users: any[]) => {
      const n = normalize(userName);
      const first = firstWord(userName);
      for (const u of users) {
        const un = normalize(u.name || "");
        const uFirst = firstWord(u.name || "");
        if (un === n || un.includes(first) || n.includes(uFirst) || un.includes(n) || n.includes(un)) return u;
      }
      return null;
    };
    try {
      const { bills: billsPayload } = req.body as { bills: Array<{
        month: string;
        year: number;
        dueDate?: string;
        items: Array<{ name: string; amount: number }>;
        payments: Array<{
          userName: string;
          entryDeduction: number;
          carryForwardAmount: number;
          paidAmount: number;
          totalDue: number;
        }>;
      }> };
      if (!billsPayload || !Array.isArray(billsPayload) || billsPayload.length === 0) {
        return res.status(400).json({ message: "bills array is required and must not be empty" });
      }
      const flatId = req.user.flatId;
      const users = await storage.getUsersByFlatId(flatId);
      if (users.length === 0) {
        return res.status(400).json({ message: "No users in flat" });
      }
      const created: { month: string; year: number; billId: string; paymentsCount: number }[] = [];
      const errors: string[] = [];
      for (const b of billsPayload) {
        const items = (b.items || []).filter(i => i && String(i.name || "").trim() && Number(i.amount) >= 0);
        if (items.length === 0) {
          errors.push(`${b.month} ${b.year}: no valid items`);
          continue;
        }
        const totalAmount = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
        const payments = b.payments || [];
        if (payments.length === 0) {
          errors.push(`${b.month} ${b.year}: no payments`);
          continue;
        }
        const splitAmount = parseFloat((totalAmount / payments.length).toFixed(2));
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const mi = monthNames.findIndex(m => m.toLowerCase() === String(b.month).trim().toLowerCase());
        const dueDate = b.dueDate ? new Date(b.dueDate) : new Date(Number(b.year), mi >= 0 ? mi : 0, 5);
        const monthStr = String(b.month || dueDate.toLocaleString("default", { month: "long" })).trim();
        const yearNum = Number(b.year) || dueDate.getFullYear();
        const bill = await storage.createBill({
          items: items.map(i => ({ name: String(i.name || "").trim(), amount: Number(i.amount) || 0 })),
          totalAmount,
          splitAmount,
          month: monthStr,
          year: yearNum,
          dueDate: isNaN(dueDate.getTime()) ? new Date(yearNum, 11, 1) : dueDate,
          flatId,
          entryDeductionEnabled: true,
          createdAt: new Date()
        });
        let paymentsCount = 0;
        for (const p of payments) {
          const user = matchUser(String(p.userName || "").trim(), users);
          if (!user) {
            errors.push(`${b.month} ${b.year}: no user match for "${p.userName}"`);
            continue;
          }
          const entryDeduction = parseFloat(Number(p.entryDeduction ?? 0).toFixed(2));
          const carryForwardAmount = parseFloat(Number(p.carryForwardAmount ?? 0).toFixed(2));
          const paidAmount = parseFloat(Number(p.paidAmount ?? 0).toFixed(2));
          const totalDue = parseFloat(Number(p.totalDue ?? 0).toFixed(2));
          const status = totalDue <= paidAmount ? "PAID" : "PENDING";
          await storage.createPayment({
            billId: bill._id,
            userId: user._id,
            flatId,
            amount: splitAmount,
            paidAmount,
            carryForwardAmount,
            entryDeduction,
            totalDue,
            status,
            dueDate: bill.dueDate,
            paidAt: status === "PAID" ? new Date() : undefined
          });
          paymentsCount++;
        }
        created.push({ month: monthStr, year: yearNum, billId: String(bill._id), paymentsCount });
      }
      res.status(201).json({ message: "Import complete", created, errors: errors.length ? errors : undefined });
    } catch (error: any) {
      console.error("Bills import failed:", error);
      res.status(500).json({ message: error?.message || "Import failed" });
    }
  });

  // Backup all bills data for the flat (admin only) — returns CSV file, month-wise
  app.get("/api/bills/backup", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }
    const escapeCsv = (v: unknown): string => {
      const s = v == null ? "" : String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const row = (arr: unknown[]) => arr.map(escapeCsv).join(",");
    try {
      const flatId = req.user.flatId;
      const bills = await storage.getBillsByFlatId(flatId);
      const lines: string[] = [];
      lines.push(row(["Record Type", "Month", "Year", "Due Date", "Total Amount", "Per Person", "Members", "Expense Name", "Expense Amount", "Member Name", "Base", "Entry Deduction", "Carry Forward", "Penalty", "Total Due", "Paid", "Remaining", "Status"]));
      for (const bill of bills) {
        const payments = await storage.getPaymentsByBillId(bill._id);
        const dueStr = bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
        const month = bill.month || "";
        const year = String(bill.year ?? "");
        const total = bill.totalAmount ?? 0;
        const perPerson = bill.splitAmount ?? 0;
        const members = payments.length;
        lines.push(row(["Bill", month, year, dueStr, total, perPerson, members, "", "", "", "", "", "", "", "", "", "", ""]));
        if (Array.isArray(bill.items)) {
          for (const item of bill.items) {
            lines.push(row(["Expense", month, year, "", "", "", "", item.name ?? "", item.amount ?? "", "", "", "", "", "", "", "", "", ""]));
          }
        }
        for (const p of payments) {
          const user = p.userId as { name?: string };
          const name = user?.name ?? "";
          const base = p.amount ?? 0;
          const entryDed = p.entryDeduction ?? 0;
          const carryFwd = p.carryForwardAmount ?? 0;
          const penaltyAmt = p.penaltyWaived ? 0 : (Number(p.penalty) || 0);
          const baseDue = (p.totalDue && p.totalDue > 0) ? p.totalDue : p.amount;
          const effectiveTotal = baseDue + penaltyAmt;
          const paid = p.paidAmount ?? 0;
          const remaining = Math.max(0, effectiveTotal - paid);
          const status = p.status ?? "PENDING";
          lines.push(row(["Payment", month, year, "", "", "", "", "", "", name, base, entryDed, carryFwd, penaltyAmt, effectiveTotal, paid, remaining, status]));
        }
        lines.push("");
      }
      const csv = lines.join("\r\n");
      const filename = `roomie-bills-backup-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csv);
    } catch (error: any) {
      console.error("Bills backup failed:", error);
      res.status(500).json({ message: error?.message || "Backup failed" });
    }
  });

  // Clear carry forward for a bill (e.g. when previous months are all paid). Admin only.
  app.post("/api/bills/:billId/clear-carry-forward", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") return res.sendStatus(403);
    try {
      const bill = await storage.getBillById(req.params.billId);
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      if (bill.flatId?.toString() !== req.user.flatId?.toString()) return res.sendStatus(403);
      const payments = await storage.getPaymentsByBillId(bill._id);
      let updated = 0;
      for (const p of payments) {
        const cf = Number(p.carryForwardAmount) || 0;
        if (cf <= 0) continue;
        const baseDue = (p.totalDue != null && p.totalDue > 0) ? p.totalDue : p.amount;
        const newTotalDue = parseFloat(Math.max(0, baseDue - cf).toFixed(2));
        await storage.updatePayment(p._id, { carryForwardAmount: 0, totalDue: newTotalDue });
        updated++;
      }
      res.json({ message: "Carry forward cleared for this bill", paymentsUpdated: updated });
    } catch (error: any) {
      console.error("Clear carry forward failed:", error);
      res.status(500).json({ message: error?.message || "Failed to clear carry forward" });
    }
  });

  // Apply penalty data from MR 10 sheet (ENTRIES section: Amount - Penalty = Total). Admin only.
  const SHEET_PENALTY_DATA: Array<{ month: string; year: number; penalties: Array<{ userName: string; penalty: number }> }> = [
    { month: "June", year: 2025, penalties: [ { userName: "Aniket Nanga", penalty: 82 }, { userName: "Rajuu dhaya", penalty: 107 } ] },
    { month: "July", year: 2025, penalties: [ { userName: "Rajuu donn", penalty: 158 }, { userName: "Kodaba Bhill", penalty: 262 } ] },
    { month: "September", year: 2025, penalties: [ { userName: "Rajuu donn", penalty: 191 }, { userName: "Aniket", penalty: 66 }, { userName: "Vishal Boss", penalty: 50 } ] },
    { month: "October", year: 2025, penalties: [ { userName: "Vishal Boss", penalty: 31 }, { userName: "Aniket", penalty: 4 }, { userName: "Rajuu donn", penalty: 40 } ] },
    { month: "November", year: 2025, penalties: [ { userName: "Vikas Nagar", penalty: 2 }, { userName: "Rajuu donn", penalty: 90 }, { userName: "Hariom Guru", penalty: 112 } ] },
    { month: "December", year: 2025, penalties: [ { userName: "Hariom Guru", penalty: 218 }, { userName: "Rajuu donn", penalty: 439 } ] },
    { month: "January", year: 2026, penalties: [ { userName: "Rajuu donn", penalty: 15 }, { userName: "Hariom Guru", penalty: 172 }, { userName: "Aniket", penalty: 13 }, { userName: "Vishal Boss", penalty: 13 } ] },
    { month: "February", year: 2026, penalties: [ { userName: "Hariom Guru", penalty: 16 }, { userName: "Vishal Boss", penalty: 16 } ] },
    { month: "March", year: 2026, penalties: [ { userName: "Rajuu donn", penalty: 0 }, { userName: "Vikas Nagar", penalty: 79 }, { userName: "Aniket", penalty: 182 }, { userName: "Hariom Guru", penalty: 29 }, { userName: "Vishal Boss", penalty: 16 } ] },
  ];
  app.post("/api/bills/apply-sheet-penalties", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") return res.sendStatus(403);
    const normalize = (s: string) => s.replace(/[^\w\s]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    const firstWord = (s: string) => (s.split(/\s+/)[0] || "").toLowerCase();
    const matchUser = (userName: string, users: any[]) => {
      const n = normalize(userName);
      const first = firstWord(userName);
      for (const u of users) {
        const un = normalize(u.name || "");
        const uFirst = firstWord(u.name || "");
        if (un === n || un.includes(first) || n.includes(uFirst) || un.includes(n) || n.includes(un)) return u;
      }
      return null;
    };
    try {
      const flatId = req.user.flatId;
      const allBills = await storage.getBillsByFlatId(flatId);
      const users = await storage.getUsersByFlatId(flatId);
      let applied = 0;
      for (const row of SHEET_PENALTY_DATA) {
        const bill = allBills.find((b: any) =>
          String(b.month || "").trim().toLowerCase() === row.month.toLowerCase() && Number(b.year) === row.year
        );
        if (!bill) continue;
        const payments = await storage.getPaymentsByBillId(bill._id);
        for (const { userName, penalty } of row.penalties) {
          const user = matchUser(userName, users);
          if (!user) continue;
          const payment = payments.find((p: any) => {
            const uid = (p.userId?._id ?? p.userId)?.toString?.();
            return uid === (user._id && typeof user._id === "string" ? user._id : String(user._id));
          });
          if (!payment) continue;
          await storage.updatePayment(payment._id, { penalty: Number(penalty), penaltyWaived: false });
          applied++;
        }
      }
      res.json({ message: "Sheet penalties applied", applied });
    } catch (error: any) {
      console.error("Apply sheet penalties failed:", error);
      res.status(500).json({ message: error?.message || "Failed to apply penalties" });
    }
  });

  // Delete ALL bills and their payments for the flat (admin only) — requires confirmation on client
  app.delete("/api/bills/all", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }
    try {
      const { deletedBills, deletedPayments } = await storage.deleteAllBillsByFlatId(req.user.flatId);
      res.status(200).json({
        message: "All bills deleted permanently from database",
        deletedBills,
        deletedPayments,
      });
    } catch (error: any) {
      console.error("Delete all bills failed:", error);
      res.status(500).json({ message: error?.message || "Failed to delete all bills" });
    }
  });

  // Get a single bill with its payments
  app.get("/api/bills/:billId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const bill = await storage.getBillById(req.params.billId);
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      if (bill.flatId?.toString() !== req.user.flatId?.toString()) {
        return res.sendStatus(403);
      }
      const payments = await storage.getPaymentsByBillId(req.params.billId);
      res.json({ ...bill, payments });
    } catch (error) {
      console.error("Failed to fetch bill:", error);
      res.status(500).json({ message: "Failed to fetch bill" });
    }
  });

  // Update bill (edit items, total, due date, etc.)
  app.patch("/api/bills/:billId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }
    try {
      const bill = await storage.getBillById(req.params.billId);
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      if (bill.flatId?.toString() !== req.user.flatId?.toString()) {
        return res.sendStatus(403);
      }
      const { items, totalAmount, month, year, dueDate, entryDeductionEnabled } = req.body;
      const updates: any = {};
      if (items != null && Array.isArray(items)) {
        updates.items = items.map((i: { name: string; amount: number; members?: string[] }) => ({
          name: String(i.name || "").trim(),
          amount: Number(i.amount) || 0,
          members: Array.isArray(i.members) ? i.members.map(String) : []
        }));
        // Always recalculate totalAmount from items — never trust the sent value
        updates.totalAmount = updates.items.reduce((s: number, i: any) => s + i.amount, 0);
      }
      if (month != null) updates.month = String(month);
      if (year != null) updates.year = Number(year);
      if (dueDate != null) {
        const d = new Date(dueDate);
        if (!isNaN(d.getTime())) updates.dueDate = d;
      }
      if (entryDeductionEnabled !== undefined) updates.entryDeductionEnabled = !!entryDeductionEnabled;

      const payments = await storage.getPaymentsByBillId(req.params.billId);
      const userCount = Math.max(1, payments.length);
      // splitAmount = average (for display); always derived from the new totalAmount
      updates.splitAmount = parseFloat((updates.totalAmount / userCount).toFixed(2));

      const updated = await storage.updateBill(req.params.billId, updates);
      if (!updated) return res.status(500).json({ message: "Failed to update bill" });

      // ── Recalculate all payment records after bill edit ──────────────────
      const newEntryDeductionEnabled = updates.entryDeductionEnabled !== undefined
        ? updates.entryDeductionEnabled
        : bill.entryDeductionEnabled;
      const newDueDate = updates.dueDate ?? bill.dueDate;

      // Per-user entry deductions:
      // - If APPROVED entries are linked to this bill (billId set), sums are authoritative.
      // - If none are linked (e.g. bill used monthly-history-only create), keep each payment's stored entryDeduction
      //   so editing split/items does not wipe deductions.
      const paymentUid = (p: { userId?: { _id?: unknown } | string | null }) =>
        (p.userId && typeof p.userId === "object" && (p.userId as { _id?: unknown })._id != null
          ? String((p.userId as { _id: unknown })._id)
          : p.userId != null
            ? String(p.userId)
            : "");

      const userEntryMap: Record<string, number> = {};
      if (newEntryDeductionEnabled) {
        try {
          const billEntries = await storage.getEntriesByBillId(req.params.billId);
          const fromLinkedEntries: Record<string, number> = {};
          for (const entry of billEntries) {
            const uid = (entry.userId?._id ?? entry.userId)?.toString?.() ?? String(entry.userId);
            if (uid) {
              fromLinkedEntries[uid] = (fromLinkedEntries[uid] || 0) + (Number(entry.amount) || 0);
            }
          }

          if (billEntries.length > 0) {
            for (const payment of payments) {
              const uid = paymentUid(payment);
              if (!uid) continue;
              userEntryMap[uid] = parseFloat((fromLinkedEntries[uid] || 0).toFixed(2));
            }
          } else {
            for (const payment of payments) {
              const uid = paymentUid(payment);
              if (!uid) continue;
              userEntryMap[uid] = parseFloat((Number(payment.entryDeduction) || 0).toFixed(2));
            }
          }
        } catch (e) {
          console.warn("Entry deduction lookup failed during bill update — keeping existing values:", e);
          for (const payment of payments) {
            const uid = paymentUid(payment);
            if (!uid) continue;
            userEntryMap[uid] = Number(payment.entryDeduction) || 0;
          }
        }
      }

      // Update each payment record with recalculated values
      const newItems = updates.items ?? bill.items;
      const calcUpdatedUserShare = (userId: string) => {
        let share = 0;
        const usersCount = Math.max(1, payments.length);
        for (const item of newItems) {
          const mems: string[] = (item.members || []).map(String);
          const isIncluded = mems.length === 0 || mems.includes(String(userId));
          if (!isIncluded) continue;
          const count = mems.length === 0 ? usersCount : mems.length;
          share += item.amount / count;
        }
        return parseFloat(share.toFixed(2));
      };

      for (const payment of payments) {
        const uid = paymentUid(payment);
        const entryDeduction = newEntryDeductionEnabled
          ? parseFloat((userEntryMap[uid] || 0).toFixed(2))
          : 0;
        const userBaseAmount = calcUpdatedUserShare(uid);
        const carryForward = Number(payment.carryForwardAmount) || 0;
        const totalDue = parseFloat(Math.max(0, userBaseAmount + carryForward - entryDeduction).toFixed(2));
        const paidAmount = Number(payment.paidAmount) || 0;
        const penalty = Number(payment.penalty) || 0;
        const penaltyWaived = !!payment.penaltyWaived;
        const effectiveTotal = parseFloat((totalDue + (penaltyWaived ? 0 : penalty)).toFixed(2));
        const newStatus = paidAmount >= effectiveTotal ? "PAID" : "PENDING";

        const paymentUpdate: any = {
          amount: userBaseAmount,
          entryDeduction,
          totalDue,
          dueDate: newDueDate,
          status: newStatus,
          penalty,
          penaltyWaived,
        };
        // Set/clear paidAt based on new status
        if (newStatus === "PAID" && !payment.paidAt) {
          paymentUpdate.paidAt = new Date();
        } else if (newStatus === "PENDING") {
          paymentUpdate.paidAt = null;
        }

        await storage.updatePayment(payment._id, paymentUpdate);
      }
      // ─────────────────────────────────────────────────────────────────────

      const updatedPayments = await storage.getPaymentsByBillId(req.params.billId);
      res.json({ ...updated, payments: updatedPayments });
    } catch (error: any) {
      console.error("Failed to update bill:", error);
      res.status(500).json({ message: error?.message || "Failed to update bill" });
    }
  });

  // Delete bill and all its payments
  app.delete("/api/bills/:billId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }
    try {
      const bill = await storage.getBillById(req.params.billId);
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      if (bill.flatId?.toString() !== req.user.flatId?.toString()) {
        return res.sendStatus(403);
      }
      const ok = await storage.deleteBill(req.params.billId);
      if (!ok) return res.status(500).json({ message: "Failed to delete bill" });
      res.status(200).json({ message: "Bill deleted" });
    } catch (error: any) {
      console.error("Failed to delete bill:", error);
      res.status(500).json({ message: "Failed to delete bill" });
    }
  });

  // Update payment — supports paidAmount and penalty (penalty adds to amount owed, shown minus from user's balance)
  app.patch("/api/payments/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const existing = await PaymentModel.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Payment not found" });
      if (existing.flatId?.toString() !== req.user.flatId?.toString()) return res.sendStatus(403);

      const newPaidAmount = req.body.paidAmount !== undefined
        ? parseFloat(req.body.paidAmount)
        : (existing.paidAmount || 0);
      const penalty = req.body.penalty !== undefined ? parseFloat(req.body.penalty) : (existing.penalty ?? 0);
      const penaltyWaived = req.body.penaltyWaived !== undefined ? !!req.body.penaltyWaived : (existing.penaltyWaived ?? false);

      const baseDue = (existing.totalDue != null && existing.totalDue > 0) ? existing.totalDue : existing.amount;
      const effectiveTotal = parseFloat((baseDue + (penaltyWaived ? 0 : penalty)).toFixed(2));
      const isFullyPaid = newPaidAmount >= effectiveTotal;

      const updatePayload: any = {
        paidAmount: newPaidAmount,
        penalty,
        penaltyWaived,
        status: isFullyPaid ? "PAID" : "PENDING",
        paidAt: isFullyPaid ? new Date() : null,
      };
      const updated = await storage.updatePayment(req.params.id, updatePayload);

      if (isFullyPaid && updated?.userId) {
        try {
          const u = updated.userId as any;
          const uid = (u._id || u)?.toString?.();
          const uname = u?.name || "User";
          if (uid) {
            const pushService = new PushNotificationService(req.user.flatId);
            await pushService.sendPaymentFullyPaidNotification({ id: uid, name: uname });
          }
        } catch (pushErr) {
          console.warn("Fully paid notification failed:", pushErr);
        }
      }

      await storage.logActivity({
        userId: req.user._id,
        type: "PAYMENT_STATUS_UPDATED",
        description: `Recorded ₹${newPaidAmount} payment for user`,
        timestamp: new Date(),
      });

      res.json(updated);
    } catch (error) {
      console.error("Failed to update payment:", error);
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  // Send payment reminder via push notification (skip if already paid)
  app.post("/api/payments/:id/remind", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.sendStatus(403);
    }

    try {
      const payment = await PaymentModel.findById(req.params.id)
        .populate("userId", "name email _id");

      if (!payment) return res.status(404).json({ message: "Payment not found" });

      const baseDue = (payment.totalDue && payment.totalDue > 0) ? payment.totalDue : payment.amount;
      const penalty = payment.penaltyWaived ? 0 : (Number(payment.penalty) || 0);
      const totalDue = baseDue + penalty;
      const remaining = Math.max(0, totalDue - (payment.paidAmount || 0));

      if (remaining <= 0 || payment.status === "PAID") {
        return res.status(400).json({ message: "Payment already complete. No reminder needed." });
      }

      const userObj = payment.userId as any;
      const userId = (userObj._id || userObj)?.toString();
      const userName = userObj.name || "User";

      try {
        const pushService = new PushNotificationService(req.user.flatId);
        await pushService.sendPaymentReminder({ id: userId, name: userName }, totalDue, remaining);
      } catch (pushError) {
        console.warn("Push notification failed for payment reminder:", pushError);
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("Failed to send payment reminder:", error);
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

      // Check if trying to change role from ADMIN and this is the last admin
      if (req.body.role && user.role === "ADMIN" && req.body.role !== "ADMIN") {
        const allUsers = await storage.getUsersByFlatId(req.user.flatId);
        const adminCount = allUsers.filter(u => u.role === "ADMIN").length;
        
        if (adminCount <= 1) {
          return res.status(400).json({ 
            message: "Cannot change role of the last admin. Make another user admin first." 
          });
        }
      }

      // Special handling for self-deactivation
      if (req.body.status === "DEACTIVATED" && userId === req.user._id) {
        const updatedUser = await storage.updateUser(userId, req.body);  // Update user first
        res.json(updatedUser);  // Send response while session still exists
        await storage.destroySessionsByUserId(userId);  // Then destroy session
        return;  // Stop here
      }

      // Normal flow for updating other users
      if (req.body.status === "DEACTIVATED") {
        await storage.destroySessionsByUserId(userId);
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
      
      // Get the original entry to know the owner
      const originalEntry = await storage.getEntriesByFlatId(req.user.flatId)
        .then(entries => entries.find(e => e && e._id.toString() === id));
      
      if (!originalEntry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      const entry = await storage.updateEntry(id, req.body);
      
      // 📢 Send notification to entry owner if someone else updated their entry
      if (entry && req.body.name && req.body.amount) {
        try {
          const entryOwnerId = typeof originalEntry.userId === 'string' 
            ? originalEntry.userId 
            : originalEntry.userId._id?.toString() || originalEntry.userId.toString();
          
          const notificationService = new PushNotificationService(req.user.flatId);
          
          // Only send notification if the updater is different from the entry owner
          if (entryOwnerId !== req.user._id) {
            const entryOwner = await storage.getUser(entryOwnerId);
            if (entryOwner) {
              await notificationService.notifyEntryUpdated(
                { id: entryOwner._id, name: entryOwner.name },
                { name: req.body.name, amount: req.body.amount },
                { name: req.user.name }
              );
            }
          }

          // ⚠️ Check and notify users with low contribution warnings after entry update
          setTimeout(async () => {
            try {
              await notificationService.checkAndNotifyLowContributionWarnings();
              console.log(`✅ Warning check completed after entry update by ${req.user.name}`);
            } catch (warningError) {
              console.error("Failed to check low contribution warnings after entry update:", warningError);
            }
          }, 1000); // Small delay to ensure entry is fully processed

        } catch (notificationError) {
          console.error("Failed to send entry updated notification:", notificationError);
          // Don't fail the request if notification fails
        }
      }
      
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
      
      // Get entry details before deletion for notification
      const entryToDelete = await storage.getEntriesByFlatId(req.user.flatId)
        .then(entries => entries.find(e => e._id.toString() === id));
      
      const success = await storage.deleteEntry(id);

      if (!success) {
        return res.status(404).json({ message: "Entry not found" });
      }

      await storage.logActivity({
        userId: req.user._id,
        type: "ENTRY_DELETED",
        description: `Deleted entry: ${entryToDelete?.name || 'Unknown'}`,
        timestamp: new Date(),
      });

      // 📢 Send notification to entry owner if someone else deleted their entry
      if (entryToDelete) {
        try {
          const entryOwnerId = typeof entryToDelete.userId === 'string' 
            ? entryToDelete.userId 
            : entryToDelete.userId._id?.toString() || entryToDelete.userId.toString();
          
          const notificationService = new PushNotificationService(req.user.flatId);
          
          // Only send notification if the deleter is different from the entry owner
          if (entryOwnerId !== req.user._id) {
            const entryOwner = await storage.getUser(entryOwnerId);
            if (entryOwner) {
              await notificationService.notifyEntryDeleted(
                { id: entryOwner._id, name: entryOwner.name },
                { name: entryToDelete.name, amount: entryToDelete.amount },
                { name: req.user.name }
              );
            }
          }

          // ⚠️ Check and notify users with low contribution warnings after entry deletion
          setTimeout(async () => {
            try {
              await notificationService.checkAndNotifyLowContributionWarnings();
              console.log(`✅ Warning check completed after entry deletion by ${req.user?.name || 'Unknown user'}`);
            } catch (warningError) {
              console.error("Failed to check low contribution warnings after entry deletion:", warningError);
            }
          }, 1000); // Small delay to ensure entry is fully processed

        } catch (notificationError) {
          console.error("Failed to send entry deleted notification:", notificationError);
          // Don't fail the request if notification fails
        }
      }

      res.json({ success: true });
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

  // Add endpoint for retrieving flat by ID
  app.get("/api/flats/:flatId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const { flatId } = req.params;
      const flat = await storage.getFlatById(flatId);

      if (!flat) {
        return res.status(404).json({ message: "Flat not found" });
      }

      res.json(flat);
    } catch (error) {
      console.error("Failed to get flat details:", error);
      res.status(500).json({ message: "Failed to get flat details" });
    }
  });

  // Update flat settings
  app.patch("/api/flats/:flatId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can update flat settings" });
    }

    try {
      const { flatId } = req.params;
      const { name, minApprovalAmount } = req.body;

      const flat = await storage.updateFlat(flatId, {
        name,
        minApprovalAmount: Number(minApprovalAmount)
      });

      if (!flat) {
        return res.status(404).json({ message: "Flat not found" });
      }

      res.json(flat);
    } catch (error) {
      console.error("Failed to update flat settings:", error);
      res.status(500).json({ message: "Failed to update flat settings" });
    }
  });

  // Delete flat
  app.delete("/api/flats/:flatId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can delete flat" });
    }

    try {
      const { flatId } = req.params;
      
      // Verify the flat exists and user belongs to it
      const flat = await storage.getFlatById(flatId);
      if (!flat) {
        return res.status(404).json({ message: "Flat not found" });
      }

     

      // Clear penalty interval for this flat
      try {
        clearPenaltyInterval(flatId);
        console.log(`✅ Cleared penalty interval for flat ${flatId}`);
      } catch (error) {
        console.error("Failed to clear penalty interval:", error);
        // Don't fail the deletion if this fails
      }

      // Perform the deletion
      const success = await storage.deleteFlat(flatId, req.user._id);
      
      if (success) {
        // Log the activity before deletion (this won't be stored since flat is deleted)
        console.log(`🗑️ Flat ${flat.name} deleted by admin ${req.user.name}`);
        
        // Don't send response on success to avoid session conflicts
        // The frontend will handle the redirect when the session becomes invalid
      } else {
        res.status(500).json({ message: "Failed to delete flat" });
      }
    } catch (error) {
      console.error("Failed to delete flat:", error);
      res.status(500).json({ message: "Failed to delete flat" });
    }
  });

  // 🔔 Push Notification Routes (for testing)
  
  // Get VAPID public key for client subscription
  app.get("/api/push/vapid-key", (req, res) => {
    res.json({ publicKey: PushNotificationService.getVapidPublicKey() });
  });

  // Subscribe to push notifications
  app.post("/api/push/subscribe", async (req, res) => {
    const { subscription, userId } = req.body;
    
    if (!subscription) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subscription object is required' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required for subscription' 
      });
    }

    try {
      const success = await PushNotificationService.addSubscription(subscription, userId);
      if (success) {
        res.json({ success: true, message: 'Subscription added successfully' });
      } else {
        res.status(500).json({ success: false, message: 'Failed to add subscription' });
      }
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: 'Error adding subscription', 
        error: error.message 
      });
    }
  });

  // Send notification to all users (testing endpoint)
  app.post("/api/push/send", async (req, res) => {
    const { title, body } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and body are required' 
      });
    }

    try {
      const result = await PushNotificationService.sendToAll(title, body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send notifications', 
        error: error.message 
      });
    }
  });

  // Get subscription count (for debugging)
  app.get("/api/push/status", async (req, res) => {
    try {
      const subscriptionCount = await PushNotificationService.getSubscriptionCount();
      res.json({ 
        subscriptions: subscriptionCount,
        vapidConfigured: true
      });
    } catch (error: any) {
      res.status(500).json({ 
        subscriptions: 0,
        vapidConfigured: true,
        error: error.message
      });
    }
  });

  // Send flat announcement (Admin only)
  app.post("/api/send-flat-announcement", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "ADMIN" && req.user.role !== "CO_ADMIN") {
      return res.status(403).json({ message: "Only admins can send announcements" });
    }

    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: "Announcement message is required" });
      }

      if (message.trim().length < 5) {
        return res.status(400).json({ message: "Announcement must be at least 5 characters long" });
      }

      if (message.trim().length > 500) {
        return res.status(400).json({ message: "Announcement cannot exceed 500 characters" });
      }

      // Send flat announcement using the notification service
      try {
        const { PushNotificationService } = await import('./push-notification-service.js');
        const notificationService = new PushNotificationService(req.user.flatId);
        const result = await notificationService.sendFlatAnnouncement(message.trim());
        
        // Log the announcement activity
        await storage.logActivity({
          userId: req.user._id,
          type: "FLAT_MANAGEMENT",
          description: `Sent flat announcement: "${message.trim().substring(0, 50)}${message.trim().length > 50 ? '...' : ''}"`,
          timestamp: new Date(),
        });

        res.json({
          success: true,
          message: "Announcement sent successfully to all flat members",
          announcementText: message.trim(),
          result
        });
      } catch (notificationError: any) {
        console.error("Failed to send flat announcement notification:", notificationError);
        res.status(500).json({ 
          message: "Failed to send announcement notification",
          error: notificationError?.message || 'Unknown error'
        });
      }
    } catch (error) {
      console.error("Failed to send flat announcement:", error);
      res.status(500).json({ message: "Failed to send announcement" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
async function checkAndApplyPenalties() {
  try {
    const { checkAndApplyPenalties: penaltyChecker } = await import('./penalty-checker.js');
    return await penaltyChecker('manual-trigger');
  } catch (error) {
    console.error('[ERROR] Failed to check and apply penalties:', error);
    throw error;
  }
}

