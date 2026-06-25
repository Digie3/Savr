import { Link } from "react-router-dom";

import { trackActivity } from "../lib/activity";

const links = [
  { label: "Home", path: "/" },
  { label: "Create Recipe", path: "/create" },
  { label: "Saved Recipes", path: "/saved" },
  { label: "Analytics", path: "/analytics" },
  { label: "Profile", path: "/profile" },
  { label: "Login", path: "/login" },
  { label: "Register", path: "/register" },
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
      </div>
    </nav>
  );
}

export default Navbar;
