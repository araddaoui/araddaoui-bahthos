import express from "express";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const routerLoaders: Record<string, () => Promise<any>> = {
  tts: () => import("../src/server/routers/tts.js"),
  chat: () => import("../src/server/routers/chat.js"),
  documents: () => import("../src/server/routers/documents.js"),
  synthesis: () => import("../src/server/routers/synthesis.js"),
  reportFollowup: () => import("../src/server/routers/reportFollowup.js"),
  glossary: () => import("../src/server/routers/glossary.js"),
  glossarySweep: () => import("../src/server/routers/glossarySweep.js"),
};

function routeKeyFromRequest(req: express.Request): string | null {
  const requestUrl = req.originalUrl || req.url || "";
  const pathname = requestUrl.split("?", 1)[0];

  if (pathname.startsWith("/api/tts")) return "tts";
  if (pathname.startsWith("/api/chat")) return "chat";
  if (pathname.startsWith("/api/analyze-document") || pathname.startsWith("/api/documents")) return "documents";
  if (pathname.startsWith("/api/synthesize")) return "synthesis";
  if (pathname.startsWith("/api/report-followup")) return "reportFollowup";
  if (pathname.startsWith("/api/glossary-sweep")) return "glossarySweep";
  if (pathname.startsWith("/api/glossary")) return "glossary";

  return null;
}

app.use(async (req, res, next) => {
  const routeKey = routeKeyFromRequest(req);
  const loader = routeKey ? routerLoaders[routeKey] : undefined;
  if (!loader) return next();

  try {
    const module = await loader();
    const router = module.default || module;
    return router(req, res, next);
  } catch (error) {
    return next(error);
  }
});

export default app;
