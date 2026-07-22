import { useState } from "react";

import { useAuth } from "../auth/useAuth";
import { searchIngredientImages } from "../lib/imageService";

// Per-ingredient "search the web for an image" picker.
// Calls the backend Image Service and lets the user select one suggested image.
// The selected image URL is lifted to the parent via onSelect(url).
function IngredientImageSearch({ ingredientName, selectedImageUrl, onSelect, disabled }) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSearch() {
    const term = (query || ingredientName || "").trim();

    if (!term) {
      setError("Enter an ingredient name to search.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await searchIngredientImages(term, token, 6);
      const images = data.images || [];
      setResults(images);

      if (data.configured === false) {
        setMessage(data.message || "Image search is not configured.");
      } else if (images.length === 0) {
        setMessage("No images found. Try a different search term.");
      }
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ingredient-image-search">
      <div className="image-search-controls">
        <input
          type="text"
          placeholder={
            ingredientName
              ? `Search images for "${ingredientName}"`
              : "Search the web for an image"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Image search term"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={disabled || loading}
        >
          {loading ? "Searching..." : "Search web images"}
        </button>
      </div>

      {error && <p className="image-search-error">{error}</p>}
      {message && <p className="image-search-message">{message}</p>}

      {results.length > 0 && (
        <div className="image-search-results" role="list" aria-label="Suggested images">
          {results.map((img) => {
            const isSelected = selectedImageUrl === img.url;

            return (
              <button
                type="button"
                key={img.url}
                role="listitem"
                className={`image-search-result${isSelected ? " selected" : ""}`}
                onClick={() => onSelect(isSelected ? "" : img.url)}
                aria-pressed={isSelected}
                aria-label={`Use image from ${img.source || "the web"}${img.title ? `: ${img.title}` : ""}`}
                title={img.title || img.source || "Suggested image"}
              >
                <img
                  src={img.thumbnailUrl || img.url}
                  alt={img.title || `Suggested image for ${ingredientName || "ingredient"}`}
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      )}

      {selectedImageUrl && (
        <p className="image-search-selected">
          Using a web image for this ingredient.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => onSelect("")}
          >
            Clear
          </button>
        </p>
      )}
    </div>
  );
}

export default IngredientImageSearch;
