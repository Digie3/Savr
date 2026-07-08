import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import RecipeCard from "../components/RecipeCard";
import { trackActivity } from "../lib/activity";
import { fetchRecipes, saveRecipe, unsaveRecipe } from "../lib/recipes";

function Home() {
  const { token } = useAuth();
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

        const data = await fetchRecipes(token);

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
  }, [token]);

  async function handleSaveToggle(recipeId, isSaved) {
    try {
      if (isSaved) {
        await unsaveRecipe(recipeId, token);
      } else {
        await saveRecipe(recipeId, token);
      }

      setRecipes((currentRecipes) =>
        currentRecipes.map((recipe) =>
          recipe.id === recipeId
            ? { ...recipe, isSaved: isSaved ? 0 : 1 }
            : recipe
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

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
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onSaveToggle={handleSaveToggle}
            showFollow={true}
          />
        ))}
      </section>
    </main>
  );
}

export default Home;
