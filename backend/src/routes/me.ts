import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { preferencesBody, updatePreferences } from "../users/preferences.js";

// The signed-in user's own settings. The user always comes from the verified token.
export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.put("/preferences", async (req, res) => {
  const user = await updatePreferences(req.user!.id, preferencesBody.parse(req.body));
  res.json({ user });
});
