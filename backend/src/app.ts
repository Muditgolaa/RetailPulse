import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { opsRouter } from "./routes/ops.js";
import { aiRouter } from "./routes/ai.js";
import { ordersRouter } from "./routes/orders.js";
import { meRouter } from "./routes/me.js";
import { supportRouter } from "./routes/support.js";
import { kbRouter } from "./routes/kb.js";
import { adminRouter, publicSettingsRouter } from "./routes/admin.js";
import { errorHandler, notFound } from "./lib/http.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1); // behind one proxy in production (Render), so req.ip is the visitor's address
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", catalogRouter); // /api/stores, /api/products (public browsing)
app.use("/api/ops", opsRouter); // manager only
app.use("/api/ai", aiRouter); // signed-in users
app.use("/api/orders", ordersRouter); // customers
app.use("/api/me", meRouter); // signed-in users
app.use("/api/kb", kbRouter); // manager only
app.use("/api/settings", publicSettingsRouter); // public
app.use("/api/admin", adminRouter); // admin only
app.use("/api/support", supportRouter); // customers chat and open tickets; managers handle them

app.use("/api", notFound);

// Production: serve the built frontend. Hashed assets are cached for a year; every other non-API path
// returns index.html so React Router can handle it.
if (env.FRONTEND_DIST && existsSync(path.join(env.FRONTEND_DIST, "index.html"))) {
  const dist = path.resolve(env.FRONTEND_DIST);
  app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(dist, { index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use(errorHandler);
