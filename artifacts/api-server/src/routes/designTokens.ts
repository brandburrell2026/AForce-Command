import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const router = Router();

router.get("/design-tokens", (_req, res) => {
  const tokensPath = resolve(process.cwd(), "../../design/aforce-tokens.json");
  try {
    const content = readFileSync(tokensPath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="aforce-tokens.json"',
    );
    res.send(content);
  } catch {
    res.status(404).json({ error: "Tokens file not found" });
  }
});

export default router;
