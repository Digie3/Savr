import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { buildMediaUrl, fetchRecipeDetail } from "../lib/recipes";

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(`${value.replace(" ", "T")}Z`));
}

function initials(name) {
  return (name || "U").trim().slice(0, 1).toUpperCase();
}

function RecipeDetails() {
  const { recipeId } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRecipe() {
      try {
        const data = await fetchRecipeDetail(recipeId);

        if (isMounted) {
          setRecipe(data.recipe);
          setIngredients(data.ingredients || []);
          setSteps(data.steps || []);
          setComments(data.comments || []);
          setError("");
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRecipe();

    return () => {
      isMounted = false;
    };
  }, [recipeId]);

  if (loading) {
    return <main className="recipe-detail-page"><p>Loading recipe...</p></main>;
  }

  if (error || !recipe) {
    return (
      <main className="recipe-detail-page">
        <p className="error-message">{error || "Recipe not found"}</p>
        <Link to="/">Back to home</Link>
      </main>
    );
  }

  return (
    <main className="recipe-detail-page">
      <Link className="back-link" to="/">Back to home feed</Link>

      <article className="recipe-detail-card">
        <div className="creator-strip detail-creator">
          <Link className="avatar" to={`/profile/${recipe.creatorId}`}>
            {initials(recipe.creatorName)}
          </Link>
          <span>
            <Link to={`/profile/${recipe.creatorId}`}><strong>{recipe.creatorName}</strong></Link>
            <small>{formatDate(recipe.datePosted)}</small>
          </span>
        </div>

        <h1>{recipe.title}</h1>
        {recipe.description && <p className="recipe-detail-description">{recipe.description}</p>}

        {recipe.imageUrl && (
          <img
            className="recipe-detail-image"
            src={buildMediaUrl(recipe.imageUrl)}
            alt={recipe.title}
          />
        )}

        <div className="recipe-detail-meta">
          <span>Prep: {recipe.prepTime} min</span>
          <span>Cook: {recipe.cookingTime} min</span>
          <span>{recipe.numServings} servings</span>
          <span>Rating: {recipe.averageRating || "Not rated"}</span>
        </div>
      </article>

      <section className="recipe-detail-grid">
        <article className="recipe-panel">
          <h2>Ingredients</h2>
          <div className="ingredient-list">
            {ingredients.map((ingredient) => (
              <div className="ingredient-row" key={ingredient.id}>
                {ingredient.imageUrl && (
                  <img src={buildMediaUrl(ingredient.imageUrl)} alt={ingredient.name} />
                )}
                <span>
                  <strong>{ingredient.name}</strong>
                  <small>
                    {ingredient.quantity} {ingredient.unit}
                    {ingredient.otherDesc ? ` - ${ingredient.otherDesc}` : ""}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="recipe-panel">
          <h2>Steps</h2>
          <div className="step-list">
            {steps.map((step) => (
              <div className="recipe-step-row" key={step.id}>
                <span className="step-number">{step.stepNumber}</span>
                <p>{step.instructionText}</p>
                {step.imageUrl && (
                  <img src={buildMediaUrl(step.imageUrl)} alt={`Step ${step.stepNumber}`} />
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="comments-panel">
        <h2>Comments</h2>
        <div className="comment-box-placeholder">
          <span className="avatar">+</span>
          <p>Comment posting will connect here. This area is reserved for the discussion thread.</p>
        </div>

        {comments.length === 0 && <p className="muted-text">No comments yet.</p>}
        {comments.map((comment) => (
          <article className="comment-row" key={comment.id}>
            <span className="avatar">{initials(comment.creatorName)}</span>
            <div>
              <strong>{comment.creatorName}</strong>
              <small>{formatDate(comment.datePosted)}</small>
              <p>{comment.description}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default RecipeDetails;
