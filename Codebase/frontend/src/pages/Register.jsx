import { Link, useNavigate } from "react-router-dom";

import { trackActivity } from "../lib/activity";

const PASSWORD_REQUIREMENT =
  "Password must be at least 6 characters long and include at least one uppercase letter.";

function isValidNewPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 6 &&
    /[A-Z]/.test(password)
  );
}

function Register() {
  const navigate = useNavigate();

  function handleRegister(event) {
    event.preventDefault();

    const form = new FormData(event.target);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (!username) {
      alert("Username is required");
      return;
    }

    if (!isValidNewPassword(password)) {
      alert(PASSWORD_REQUIREMENT);
      return;
    }

    if (password !== confirm) {
      alert("Passwords must match");
      return;
    }

    fetch("http://localhost:4000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .then((error) => Promise.reject(error));
        }

        return response.json();
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
      .catch((error) =>
        alert(error.error || "Registration failed")
      );
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
          <input
            name="username"
            type="text"
            placeholder="Username"
            required
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            minLength={6}
            pattern="(?=.*[A-Z]).{6,}"
            title={PASSWORD_REQUIREMENT}
            required
          />

          <small className="password-requirement">
            {PASSWORD_REQUIREMENT}
          </small>

          <input
            name="confirm"
            type="password"
            placeholder="Confirm Password"
            required
          />

          <button type="submit">Register</button>
        </form>

        <Link to="/login">Already have an account?</Link>
      </section>
    </main>
  );
}

export default Register;