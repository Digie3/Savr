import { Link, useNavigate } from "react-router-dom";

import { trackActivity } from "../lib/activity";
import { useAuth } from "../auth/useAuth";
import { API_BASE } from "../api";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  function handleLogin(event) {
    event.preventDefault();

    const form = new FormData(event.target);
    const username = form.get("username");
    const password = form.get("password");

    fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e));
        return r.json();
      })
      .then((data) => {
        // Stores the JWT + user, and keeps localStorage "savrUser" in sync
        // so analytics events are attributed to the logged-in user.
        login(data.token, data.user);
        trackActivity({
          eventType: "page_view",
          entityType: "page",
          entityId: "home-after-login",
          metadata: { path: "/home" },
        });
        navigate("/home");
      })
      .catch((err) => alert(err.error || "Login failed"));
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <h1>Savr</h1>
        <p>Discover recipes, follow creators, and save your next favorite meal.</p>
      <div className="auth-highlights">
  <p>🥘 Share your own recipes</p>
  <p>⭐ Rate and comment on dishes</p>
  <p>🔖 Save recipes for later</p>
</div>
      </section>

      <section className="auth-card">
        <h1>Login</h1>
        <p>Sign in to continue exploring recipes.</p>

        <form onSubmit={handleLogin}>
          <input name="username" type="text" placeholder="Enter your username" />
          <input name="password" type="password" placeholder="Enter your password" />
          <button type="submit">Login</button>
        </form>

        <Link to="/register">Create an account</Link>
      </section>
    </main>
  );
}

export default Login;
