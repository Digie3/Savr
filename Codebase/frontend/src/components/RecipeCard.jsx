import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { buildMediaUrl } from "../lib/recipes";
import FollowButton from "./FollowButton";

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

function RecipeCard({ recipe, onSaveToggle, showFollow = false }) {
  const { token, user } = useAuth();
  
  const navigate = useNavigate();
  const isSaved = Boolean(recipe.isSaved);
  const isOwnRecipe = user?.id === recipe.creatorId;

  async function handleSaveClick() {
    if (!token) {
      navigate("/login");
      return;
    }

    await onSaveToggle(recipe.id, isSaved);
  }

  return (
    <article className="feed-card">
      <div className="feed-card-vote">
        <span>★</span>
        <strong>{recipe.averageRating || "-"}</strong>
      </div>

      <div className="feed-card-main">
        <div className="feed-card-topline">
          <Link className="creator-strip" to={`/profile/${recipe.creatorId}`}>
            <span className="avatar">{initials(recipe.creatorName)}</span>
            <span>
              <strong>{recipe.creatorName}</strong>
              <small>{formatDate(recipe.datePosted)}</small>
            </span>
          </Link>

          <div className="recipe-card-actions">
            {showFollow && token && recipe.creatorId && !isOwnRecipe && (
              <FollowButton userId={recipe.creatorId} />
            )}

            <button
              className={`save-recipe-btn${isSaved ? " is-saved" : ""}`}
              type="button"
              onClick={handleSaveClick}
            >
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

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
  );
}

export default RecipeCard;