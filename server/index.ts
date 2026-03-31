import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register API routes
const server = registerRoutes(app);

(async () => {
  try {
    await storage.connect();

    // If server was down at month boundary, catch up previous calendar month once (snapshot + close + optional purge).
    try {
      const { snapshotCloseAndPurgeAccountingMonth } = await import("./ledger-month-rollover.js");
      const { previousCalendarMonthKey } = await import("./lib/accounting-month.js");
      const { isAutoClosePreviousAccountingMonthEnabled } = await import("./auto-close-config.js");
      if (isAutoClosePreviousAccountingMonthEnabled()) {
        const key = previousCalendarMonthKey();
        const flats = await storage.getAllFlats();
        for (const flat of flats) {
          const fid = String(flat._id);
          try {
            if (await storage.isAccountingMonthLocked(fid, key)) continue;
            await snapshotCloseAndPurgeAccountingMonth(fid, key);
          } catch (e) {
            console.warn(`📅 Startup month rollover skipped for flat ${fid}:`, e);
          }
        }
        console.log(`📅 Startup month rollover pass completed for ${key}`);
      }
    } catch (e) {
      console.warn("Startup month rollover catch-up failed:", e);
    }

    const { startPenaltyCheckers } = await import("./penalty-checker");
    startPenaltyCheckers().catch(e => console.error("Penalty checker init error:", e));

    const { startAccountingMonthCloseCron } = await import("./month-close-cron");
    startAccountingMonthCloseCron();

    // Static assets caching middleware
    app.use((req, res, next) => {
      // Cache static images for 1 week
      if (req.path.startsWith("/static/images/")) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      }
      // Cache other static assets for 1 day
      else if (req.path.startsWith("/static/")) {
        res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
      }
      // No caching for API and other routes
      else {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }
      next();
    });

    // Error-handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error(`❌ Error [${status}]: ${message}`);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.SERVER_PORT || 5000;
    server.listen(PORT, () => {
      log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start the server:", error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📅 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📅 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
