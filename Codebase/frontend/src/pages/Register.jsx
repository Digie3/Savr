import { Link, useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();

  function handleRegister(event) {
    event.preventDefault();
    navigate("/login");
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
          <input type="text" placeholder="Username" />

          <input type="email" placeholder="Email Address" />

          <input type="password" placeholder="Password" />
          <input type="password" placeholder="Confirm Password" />


          <button type="submit">Register</button>
        </form>

        <Link to="/login">Already have an account?</Link>
      </section>
    </main>
  );
}

export default Register;