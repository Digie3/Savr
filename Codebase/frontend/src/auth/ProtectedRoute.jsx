import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wrap any route that should require a logged-in user.
// While the token is still being validated we wait; if there's no user,
// we redirect to the login page.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <p style={{ padding: "2rem" }}>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

export default ProtectedRoute;
