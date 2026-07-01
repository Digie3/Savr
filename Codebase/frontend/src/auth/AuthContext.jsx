import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE } from "../api";

const AuthContext = createContext(null);
const TOKEN_KEY = "savr_token";
// The lakehouse analytics helper (lib/activity.js) reads the logged-in user
// from this key, so we keep it in sync with our auth state.
const USER_KEY = "savrUser";

// Wraps the app and exposes the current user, the JWT, and login/logout helpers.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Whenever we have a token, validate it against the backend (/me).
  // If it's missing/expired we clear it so the UI shows logged-out state.
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      })
      .catch((err) => {
        if (err.message === "401") {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Called by the Login page after a successful /login response.
  function login(newToken, newUser) {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  // Tell the backend, then forget the token locally.
  async function logout() {
    try {
      if (token) {
        await fetch(`${API_BASE}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignore network errors — we clear the local session regardless.
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Convenience hook so components can read auth state with useAuth().
export function useAuth() {
  return useContext(AuthContext);
}
