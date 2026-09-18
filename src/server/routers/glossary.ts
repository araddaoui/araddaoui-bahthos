import { Router } from "express";

const router = Router();
router.post("/api/extract-glossary", (_req, res) => {
  res.status(503).json({ error: "خدمة استخراج المصطلحات غير متاحة حالياً.", code: "service/unavailable", terms: [], isFallback: true });
});

export default router;