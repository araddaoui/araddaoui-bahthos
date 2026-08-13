import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import ttsRouter from "./src/server/routers/tts";
import chatRouter from "./src/server/routers/chat";
import documentsRouter from "./src/server/routers/documents";
import synthesisRouter from "./src/server/routers/synthesis";
import reportFollowupRouter from "./src/server/routers/reportFollowup";
import glossaryRouter from "./src/server/routers/glossary";
import glossarySweepRouter from "./src/server/routers/glossarySweep";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(ttsRouter);
app.use(chatRouter);
app.use(documentsRouter);
app.use(synthesisRouter);
app.use(reportFollowupRouter);
app.use(glossaryRouter);
app.use(glossarySweepRouter);

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
