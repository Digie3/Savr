import { Link, useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  function handleLogin(event) {
    event.preventDefault();
    navigate("/home");
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
          <input type="email" placeholder="Enter your email" />
          <input type="password" placeholder="Enter your password" />
          <button type="submit">Login</button>
        </form>

        <Link to="/register">Create an account</Link>
      </section>
    </main>
  );
}

export default Login;