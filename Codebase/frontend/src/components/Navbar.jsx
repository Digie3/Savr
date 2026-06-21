import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">Savr</div>

      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/create">Create Recipe</Link>
        <Link to="/saved">Saved Recipes</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </div>
    </nav>
  );
}

export default Navbar;