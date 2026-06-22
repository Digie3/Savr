import { Link, useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  function handleLogin(event) {
    event.preventDefault();
    
    const form = new FormData(event.target);
    const username = form.get("username");
    const password = form.get("password");

    fetch("http://localhost:4000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e));
        return r.json();
      })
      .then(() => navigate("/home"))
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