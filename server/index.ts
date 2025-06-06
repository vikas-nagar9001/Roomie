import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import "./penalty-checker"; // Import penalty checker

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register API routes
const server = registerRoutes(app);

(async () => {
  try {
    await storage.connect();

    // 🔹 Middleware to set cache-control headers
    app.use((req, res, next) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store"); // For CDNs
      next();
    });

    // 🔹 Error-handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error(`❌ Error [${status}]: ${message}`);

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate"); // Ensure error responses are not cached
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT || 6000;
    server.listen( PORT , () => {
      log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start the server:", error);
    process.exit(1);
  }
})();
