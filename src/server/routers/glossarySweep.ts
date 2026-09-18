import { Router } from "express";

const router = Router();
router.post("/api/sweep-glossary", (_req, res) => {
  res.status(503).json({ error: "خدمة تنقية المصطلحات غير متاحة حالياً.", code: "service/unavailable", terms: [], isFallback: true });
});

export default router;