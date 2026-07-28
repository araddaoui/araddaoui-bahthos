import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to import server from multiple possible locations
let app;
try {
  // Try relative path first (for local dev)
  const serverModule = await import(path.join(__dirname, "../server.js"));
  app = serverModule.default;
} catch {
  try {
    // Try from current directory (for Vercel)
    const serverModule = await import(path.join(__dirname, "server.js"));
    app = serverModule.default;
  } catch {
    try {
      // Try from root (fallback)
      const serverModule = await import(path.join(process.cwd(), "server.js"));
      app = serverModule.default;
    } catch {
      console.error("Could not find server module. Using fallback app.");
      // Fallback: create a minimal app
      import express from "express";
      const fallbackApp = express();
      fallbackApp.get("/api/health", (req, res) => res.json({ status: "ok" }));
      app = fallbackApp;
    }
  }
}

export default app;