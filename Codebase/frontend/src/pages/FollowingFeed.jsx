import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import RecipeCard from "../components/RecipeCard";
import {fetchFollowingRecipes,saveRecipe, unsaveRecipe,
} from "../lib/recipes";
import { trackActivity } from "../lib/activity";

function FollowingFeed() {
  const { token } = useAuth();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadFollowingFeed() {
      if (!token) {
  if (isMounted) {
    setRecipes([]);
    setLoading(false);
  }
  return;
}

      try {
        trackActivity({
          eventType: "page_view",
          entityType: "page",
          entityId: "following",
          metadata: {
            path: "/following",
          },
        });

        const data = await fetchFollowingRecipes(token);

        if (isMounted) {
setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFollowingFeed();

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
            ? {
                ...recipe,
                isSaved: isSaved ? 0 : 1,
              }
            : recipe
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }
   function handleFollowChange(creatorId, isFollowing) {
    if (!isFollowing) {
      setRecipes((currentRecipes) =>
        currentRecipes.filter(
          (recipe) => Number(recipe.creatorId) !== Number(creatorId)
        )
      );
    }
  }

  return (
    <main className="feed-page">
      <section className="feed-header">
        <div>
          <p className="badge">Following</p>
          <h1>Recipes From People You Follow</h1>
          <p>
            See the latest recipes posted by creators you are following.
          </p>
        </div>

        <Link className="primary-btn" to="/">
          Find Recipes
        </Link>
      </section>

      {loading && (
        <p className="feed-status">Loading following feed...</p>
      )}

      {error && <p className="error-message">{error}</p>}

      {!loading && !error && recipes.length === 0 && (
        <section className="empty-feed">
          <h2>No followed recipes yet</h2>
          <p>
            Follow creators from the home page to see their recipes here.
          </p>

          <Link className="primary-btn" to="/">
            Explore Recipes
          </Link>
        </section>
      )}

      <section className="feed-list">
  {Array.isArray(recipes) &&
    recipes.map((recipe) => (
      <RecipeCard
        key={recipe.id}
        recipe={recipe}
        onSaveToggle={handleSaveToggle}
          onFollowChange={handleFollowChange}

        showFollow={true}
      />
    ))}
</section>
    </main>
  );
}



export default FollowingFeed;