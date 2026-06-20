
import { Link } from "react-router-dom";
import heroFood from "../assets/hero-food.jpg";
function Landing() {
  return (
    <main className="landing-page">
      <section className="landing-left">
        <div className="small-logo">🍲</div>
        <p className="badge">Recipe Sharing Platform</p>

        <h1>
          Welcome to <span>Savr</span>
        </h1>

        <h2>Share recipes. Discover flavors. Cook together.</h2>

        <p>
          Savr is a recipe-focused social platform where users can share recipes,
          follow creators, save favorites, and discover new cooking ideas.
        </p>

        <div className="landing-buttons">
          <Link className="primary-btn" to="/register">Get Started</Link>
          <Link className="secondary-btn" to="/login">Login</Link>
        </div>
      </section>

     <section className="landing-right">
  <img
    src={heroFood}
    alt="Recipe Collection"
    className="hero-image"
  />
</section>
    </main>
  );
}

export default Landing;