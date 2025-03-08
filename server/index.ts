import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const versionFilePath = path.join(__dirname, "..", "version.txt");

// 🔹 Middleware to check `version.txt` on every request
app.use((req, res, next) => {
  if (fs.existsSync(versionFilePath)) {
    const version = fs.readFileSync(versionFilePath, "utf8").trim();

    if (version === "new") {
      console.log("🔄 New version detected! Clearing cache...");

      // 🔹 Invalidate cache by setting response headers
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // 🔹 Reset `version.txt` to "old" after clearing cache
      fs.writeFileSync(versionFilePath, "old", "utf8");
      console.log("✅ Version reset to old.");
    }
  }
  next();
});

// Register API routes
const server = registerRoutes(app);

(async () => {
  try {
    await storage.connect();

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = 1000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start the server:", error);
    process.exit(1);
  }
})();
