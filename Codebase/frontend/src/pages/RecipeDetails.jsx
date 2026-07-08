import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import {
  createComment,
  updateComment,
  deleteComment,
  submitRating,
} from "../lib/commentRatingService";
import { buildMediaUrl, fetchRecipeDetail, saveRecipe, unsaveRecipe } from "../lib/recipes";

// Keep in sync with MAX_COMMENT_LENGTH in the backend (index.js).
const MAX_COMMENT_LENGTH = 1000;

function formatDate(value) {
  if (!value) return "";

  try {
    const normalizedValue = String(value).trim();
    const normalizedDate = normalizedValue.includes("T")
      ? normalizedValue
      : normalizedValue.replace(" ", "T");
    const parsedDate = new Date(normalizedDate.endsWith("Z") ? normalizedDate : `${normalizedDate}Z`);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Toronto",
    }).format(parsedDate);
  } catch {
    return "";
  }
}

function initials(name) {
  return (name || "U").trim().slice(0, 1).toUpperCase();
}

function RecipeDetails() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [rating, setRating] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRecipe() {
      try {
        const data = await fetchRecipeDetail(recipeId, token);

        if (isMounted) {
          setRecipe(data.recipe);
          setIngredients(data.ingredients || []);
          setSteps(data.steps || []);
          setComments(data.comments || []);
          // Preselect the rating this user previously gave, if any.
          if (data.recipe?.userRating) {
            setRating(String(data.recipe.userRating));
          }
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
  }, [recipeId, token]);

  async function handleSaveToggle() {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      if (recipe.isSaved) {
        await unsaveRecipe(recipe.id, token);
        setRecipe((currentRecipe) => ({ ...currentRecipe, isSaved: 0 }));
      } else {
        await saveRecipe(recipe.id, token);
        setRecipe((currentRecipe) => ({ ...currentRecipe, isSaved: 1 }));
      }

      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();

    if (!token) {
      navigate("/login");
      return;
    }

    const description = commentText.trim();
    if (!description) {
      setError("Please enter a comment.");
      return;
    }

    if (description.length > MAX_COMMENT_LENGTH) {
      setError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    try {
      setSubmitting(true);
      const result = await createComment(recipe.id, description, token);
      setComments((currentComments) => [result.comment, ...currentComments]);
      setCommentText("");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(comment) {
    setEditingId(comment.id);
    setEditingText(comment.description);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function handleCommentUpdate(commentId) {
    const description = editingText.trim();
    if (!description) {
      setError("Comment cannot be empty.");
      return;
    }

    if (description.length > MAX_COMMENT_LENGTH) {
      setError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    try {
      setSubmitting(true);
      const result = await updateComment(recipe.id, commentId, description, token);
      setComments((current) =>
        current.map((c) => (c.id === commentId ? { ...c, ...result.comment } : c))
      );
      cancelEdit();
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommentDelete(commentId) {
    if (!window.confirm("Delete this comment?")) {
      return;
    }

    try {
      setSubmitting(true);
      await deleteComment(recipe.id, commentId, token);
      setComments((current) => current.filter((c) => c.id !== commentId));
      if (editingId === commentId) cancelEdit();
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRatingSubmit(event) {
    event.preventDefault();

    if (!token) {
      navigate("/login");
      return;
    }

    const nextRating = Number(rating);
    if (!Number.isInteger(nextRating) || nextRating < 1 || nextRating > 5) {
      setError("Please choose a rating from 1 to 5.");
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitRating(recipe.id, nextRating, token);
      setRecipe((currentRecipe) => ({
        ...currentRecipe,
        averageRating: result.rating.averageRating,
        ratingCount: result.rating.ratingCount,
        userRating: result.rating.stars,
      }));
      setRating(String(nextRating));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

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

        <div className="recipe-detail-title-row">
          <h1>{recipe.title}</h1>
          <button
            className={`save-recipe-btn${recipe.isSaved ? " is-saved" : ""}`}
            type="button"
            onClick={handleSaveToggle}
          >
            {recipe.isSaved ? "Saved" : "Save"}
          </button>
        </div>

        {recipe.description && (
          <p className="recipe-detail-description preserve-whitespace">
            {recipe.description}
          </p>
        )}

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
          <span>
            Rating:{" "}
            {recipe.averageRating
              ? `${recipe.averageRating} (${recipe.ratingCount} rating${recipe.ratingCount === 1 ? "" : "s"})`
              : "Not rated"}
          </span>
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
                <p className="step-detail-text">{step.instructionText}</p>
                {step.imageUrl && (
                  <img src={buildMediaUrl(step.imageUrl)} alt={`Step ${step.stepNumber}`} />
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="comments-panel">
        <h2>Comments & Ratings</h2>

        <form className="comment-box-placeholder" onSubmit={handleCommentSubmit}>
          <span className="avatar">+</span>
          <div style={{ flex: 1 }}>
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              rows={3}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Share your thoughts about this recipe"
              aria-label="Write a comment"
            />
            <div className="comment-actions">
              <small className="char-count">
                {commentText.length}/{MAX_COMMENT_LENGTH}
              </small>
              <button type="submit" disabled={submitting}>Post comment</button>
            </div>
          </div>
        </form>

        <form className="rating-form" onSubmit={handleRatingSubmit}>
          <label htmlFor="recipe-rating">Your rating</label>
          <select id="recipe-rating" value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="">Select</option>
            <option value="1">1 star</option>
            <option value="2">2 stars</option>
            <option value="3">3 stars</option>
            <option value="4">4 stars</option>
            <option value="5">5 stars</option>
          </select>
          <button type="submit" disabled={submitting}>
            {recipe.userRating ? "Update rating" : "Submit rating"}
          </button>
          {recipe.userRating ? (
            <span className="your-rating-note">You rated this {recipe.userRating}/5</span>
          ) : null}
        </form>

        {comments.length === 0 && <p className="muted-text">No comments yet.</p>}
        {comments.map((comment) => {
          const isOwner = user && comment.creatorId === user.id;
          const isEditing = editingId === comment.id;

          return (
            <article className="comment-row" key={comment.id}>
              <span className="avatar">{initials(comment.creatorName)}</span>
              <div style={{ flex: 1 }}>
                <strong>{comment.creatorName}</strong>
                <small>{formatDate(comment.datePosted)}</small>

                {isEditing ? (
                  <div className="comment-edit">
                    <textarea
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      rows={3}
                      maxLength={MAX_COMMENT_LENGTH}
                      aria-label="Edit your comment"
                    />
                    <div className="comment-actions">
                      <small className="char-count">
                        {editingText.length}/{MAX_COMMENT_LENGTH}
                      </small>
                      <button
                        type="button"
                        onClick={() => handleCommentUpdate(comment.id)}
                        disabled={submitting}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={cancelEdit}
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>{comment.description}</p>
                )}

                {isOwner && !isEditing && (
                  <div className="comment-owner-actions">
                    <button
                      type="button"
                      onClick={() => startEdit(comment)}
                      aria-label="Edit your comment"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommentDelete(comment.id)}
                      aria-label="Delete your comment"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default RecipeDetails;
