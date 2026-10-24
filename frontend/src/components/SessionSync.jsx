import { useEffect } from "react";
import { fetchMe } from "../api/shop.js";
import { useAuth } from "../store/auth.js";

// On page load, confirms the stored token with the server and refreshes the user (and role) from it.
// A 401 signs the user out via the Axios interceptor.
export default function SessionSync() {
  const token = useAuth((s) => s.token);
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    if (!token) return;
    fetchMe().then(setUser).catch(() => {});
  }, [token, setUser]);

  return null;
}
