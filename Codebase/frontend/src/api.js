// Base URL of the backend auth service.
// Override at build time with VITE_API_BASE if the backend runs elsewhere.
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
