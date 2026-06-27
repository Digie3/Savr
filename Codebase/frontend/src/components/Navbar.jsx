import { Link, useNavigate } from "react-router-dom";

import { trackActivity } from "../lib/activity";
import { useAuth } from "../auth/AuthContext";

// Links shown to everyone. Login/Register/Logout are handled separately
// below because they depend on whether the user is signed in.
const links = [
  { label: "Home", path: "/" },
  { label: "Create Recipe", path: "/create" },
  { label: "Saved Recipes", path: "/saved" },
  { label: "Analytics", path: "/analytics" },
  { label: "Profile", path: "/profile" },
];

function trackNavClick(label, path) {
  trackActivity({
    eventType: "click",
    entityType: "page",
    entityId: path === "/" ? "home" : path.replace("/", ""),
    metadata: {
      label,
      path,
      component: "Navbar",
      action: `Clicked ${label}`,
    },
  });
}

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    trackNavClick("Logout", "/logout");
    logout();
    navigate("/");
  }

  return (
    <nav className="navbar">
      <div className="logo">Savr</div>

      <div className="nav-links">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            onClick={() => trackNavClick(link.label, link.path)}
          >
            {link.label}
          </Link>
        ))}

        {user ? (
          <>
            <span className="nav-user">Hi, {user.username}</span>
            <button className="nav-logout" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={() => trackNavClick("Login", "/login")}>Login</Link>
            <Link to="/register" onClick={() => trackNavClick("Register", "/register")}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
