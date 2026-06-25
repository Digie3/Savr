import { Link, useNavigate } from "react-router-dom";

import { trackActivity } from "../lib/activity";

function Register() {
  const navigate = useNavigate();

  function handleRegister(event) {
    event.preventDefault();
    
    const form = new FormData(event.target);
    const username = form.get("username");
    const password = form.get("password");
    const confirm = form.get("confirm");

    if (password !== confirm) {
      alert("Passwords must match");
      return;
    }

    fetch("http://localhost:4000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e));
        return r.json();
      })
      .then(() => {
        trackActivity({
          username,
          eventType: "page_view",
          entityType: "page",
          entityId: "login-after-register",
          metadata: { path: "/login" },
        });
        navigate("/login");
      })
      .catch((err) => alert(err.error || "Registration failed"));
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <h1>Join Savr</h1>

        <p>
          Create an account to share recipes, discover new dishes, and connect
          with food lovers.
        </p>

        <div className="auth-highlights">
          <p>🥘 Share your own recipes</p>
          <p>⭐ Rate and comment on dishes</p>
          <p>🔖 Save recipes for later</p>
        </div>
      </section>

      <section className="auth-card">
        <h1>Create Account</h1>

        <p>Start your food journey with Savr.</p>

        <form onSubmit={handleRegister}>
          <input name="username" type="text" placeholder="Username" />

          <input name="password" type="password" placeholder="Password" />
          <input name="confirm" type="password" placeholder="Confirm Password" />

          <button type="submit">Register</button>
        </form>

        <Link to="/login">Already have an account?</Link>
      </section>
    </main>
  );
}

export default Register;
