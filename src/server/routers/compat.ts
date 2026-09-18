import { Router } from "express";

export function unavailableRouter(route: string, message: string): Router {
  const router = Router();
  router.post(route, (_req, res) => {
    res.status(503).json({ error: message, code: "service/unavailable", isFallback: true });
  });
  return router;
}