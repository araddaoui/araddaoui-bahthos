import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { requireAuth } from "./src/server/middleware/auth";
import ttsRouter from "./src/server/routers/tts";
import chatRouter from "./src/server/routers/chat";
import documentsRouter from "./src/server/routers/documents";
import synthesisRouter from "./src/server/routers/synthesis";
import reportFollowupRouter from "./src/server/routers/reportFollowup";
import glossaryRouter from "./src/server/routers/glossary";
import glossarySweepRouter from "./src/server/routers/glossarySweep";
import billingRouter, { stripeWebhookHandler } from "./src/server/routers/billing";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Stripe Webhook MUST receive raw Buffer before express.json() parses the body
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health check endpoint remains open without auth
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Enforce Firebase ID token verification & guest preservation for API endpoints
app.use("/api", requireAuth);

app.use(ttsRouter);
app.use(chatRouter);
app.use(documentsRouter);
app.use(synthesisRouter);
app.use(reportFollowupRouter);
app.use(glossaryRouter);
app.use(glossarySweepRouter);
app.use(billingRouter);

// Parity with api/index.ts: fallback for unknown /api routes.
app.use("/api", (req, res) => {
  res.status(404).json({ error: `Unknown API route: ${req.originalUrl || req.url}` });
});

// Central error handler so any thrown exception is returned as readable JSON
// instead of an empty 500 that is impossible to debug.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error:", err);
  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({ error: err?.message || "Internal server error." });
});

// Serve frontend with Vite in development, or statically in production.
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  setupViteOrStatic().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
