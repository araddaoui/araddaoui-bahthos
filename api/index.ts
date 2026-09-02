import express from "express";
import ttsRouter from "../src/server/routers/tts.js";
import chatRouter from "../src/server/routers/chat.js";
import documentsRouter from "../src/server/routers/documents.js";
import synthesisRouter from "../src/server/routers/synthesis.js";
import reportFollowupRouter from "../src/server/routers/reportFollowup.js";
import glossaryRouter from "../src/server/routers/glossary.js";
import glossarySweepRouter from "../src/server/routers/glossarySweep.js";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Mount every router statically so Vercel can bundle them into the serverless
// function. Dynamic import() of sibling .js files is unreliable in serverless
// deployments and caused silent 500s with empty responses.
// Note: every router's routes already include the "/api" prefix, so they are
// mounted at the root (NOT under "/api") to avoid a doubled "/api/api" path.
app.use(ttsRouter);
app.use(chatRouter);
app.use(documentsRouter);
app.use(synthesisRouter);
app.use(reportFollowupRouter);
app.use(glossaryRouter);
app.use(glossarySweepRouter);

// Fallback for unknown /api routes.
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

export default app;