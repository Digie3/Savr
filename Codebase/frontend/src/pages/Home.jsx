import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { trackActivity } from "../lib/activity";
import { buildMediaUrl, fetchRecipes } from "../lib/recipes";

function formatDate(value) {
  if (!value) return "Recently";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(`${value.replace(" ", "T")}Z`));
}

function initials(name) {
  return (name || "U").trim().slice(0, 1).toUpperCase();
}

function Home() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRecipes() {
      try {
        trackActivity({
          eventType: "page_view",
          entityType: "page",
          entityId: "home",
          metadata: { path: "/" },
        });

        const data = await fetchRecipes();

        if (isMounted) {
          setRecipes(data.recipes || []);
          setError("");
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRecipes();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="feed-page">
      <section className="feed-header">
        <div>
          <p className="badge">Home</p>
          <h1>Latest Recipes</h1>
          <p>Browse recipe posts from Savr creators and open a post to view details and comments.</p>
        </div>
        <Link className="primary-btn" to="/create">Create Recipe</Link>
      </section>

      {loading && <p className="feed-status">Loading recipes...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && recipes.length === 0 && (
        <section className="empty-feed">
          <h2>No recipes yet</h2>
          <p>Create the first recipe to start the home feed.</p>
        </section>
      )}

      <section className="feed-list">
        {recipes.map((recipe) => (
          <article className="feed-card" key={recipe.id}>
            <div className="feed-card-vote">
              <span>★</span>
              <strong>{recipe.averageRating || "-"}</strong>
            </div>

            <div className="feed-card-main">
              <Link className="creator-strip" to={`/profile/${recipe.creatorId}`}>
                <span className="avatar">{initials(recipe.creatorName)}</span>
                <span>
                  <strong>{recipe.creatorName}</strong>
                  <small>{formatDate(recipe.datePosted)}</small>
                </span>
              </Link>

              <Link className="recipe-post-link" to={`/recipes/${recipe.id}`}>
                <h2>{recipe.title}</h2>
                {recipe.description && <p>{recipe.description}</p>}
                {recipe.imageUrl && (
                  <img
                    className="feed-recipe-image"
                    src={buildMediaUrl(recipe.imageUrl)}
                    alt={recipe.title}
                  />
                )}
              </Link>

              <div className="feed-card-meta">
                <span>{recipe.prepTime + recipe.cookingTime} min</span>
                <span>{recipe.numServings} servings</span>
                <span>{recipe.commentCount} comments</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default Home;
