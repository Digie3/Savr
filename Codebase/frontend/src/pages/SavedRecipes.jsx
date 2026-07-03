import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import RecipeCard from "../components/RecipeCard";
import { fetchSavedRecipes, saveRecipe, unsaveRecipe } from "../lib/recipes";

function SavedRecipes() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSavedRecipes() {
      try {
        const data = await fetchSavedRecipes(token);

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

    loadSavedRecipes();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSaveToggle(recipeId, isSaved) {
    try {
      if (isSaved) {
        await unsaveRecipe(recipeId, token);
        setRecipes((currentRecipes) =>
          currentRecipes.filter((recipe) => recipe.id !== recipeId)
        );
        return;
      }

      await saveRecipe(recipeId, token);
      setRecipes((currentRecipes) =>
        currentRecipes.map((recipe) =>
          recipe.id === recipeId ? { ...recipe, isSaved: 1 } : recipe
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
          <p className="badge">Saved Recipes</p>
          <h1>Your Saved Recipes</h1>
          <p>Recipes you bookmark from the home feed and recipe detail pages appear here.</p>
        </div>
        <Link className="primary-btn" to="/">Browse Recipes</Link>
      </section>

      {loading && <p className="feed-status">Loading saved recipes...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && recipes.length === 0 && (
        <section className="empty-feed">
          <h2>No saved recipes yet</h2>
          <p>Save recipes from the home feed to build your personal cookbook.</p>
          <Link className="primary-btn" to="/">Find Recipes</Link>
        </section>
      )}

      <section className="feed-list">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onSaveToggle={handleSaveToggle}
          />
        ))}
      </section>
    </main>
  );
}

export default SavedRecipes;
