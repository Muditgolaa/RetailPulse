import express from "express";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { opsRouter } from "./routes/ops.js";
import { aiRouter } from "./routes/ai.js";
import { ordersRouter } from "./routes/orders.js";
import { meRouter } from "./routes/me.js";
import { supportRouter } from "./routes/support.js";
import { kbRouter } from "./routes/kb.js";
import { errorHandler, notFound } from "./lib/http.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", catalogRouter); // /api/stores, /api/products (public browsing)
app.use("/api/ops", opsRouter); // manager only
app.use("/api/ai", aiRouter); // signed-in users
app.use("/api/orders", ordersRouter); // customers
app.use("/api/me", meRouter); // signed-in users
app.use("/api/kb", kbRouter); // manager only
app.use("/api/support", supportRouter); // customers chat and open tickets; managers handle them

app.use("/api", notFound);
app.use(errorHandler);
