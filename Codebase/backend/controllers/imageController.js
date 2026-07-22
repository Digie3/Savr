import {
  isImageSearchConfigured,
  searchIngredientImages,
} from "../services/imageService.js";

const PROVIDER = "google-custom-search";
const MAX_QUERY_LENGTH = 100;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;

// GET /images/search?ingredient=tomato&limit=6
// Returns suggested images for an ingredient. Auth-gated (see imageRoutes.js).
export async function searchImages(req, res) {
  try {
    const rawQuery = (req.query.ingredient ?? req.query.q ?? "").toString().trim();

    if (!rawQuery) {
      return res.status(400).json({ error: "An ingredient query is required" });
    }

    if (rawQuery.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({
        error: `Query cannot exceed ${MAX_QUERY_LENGTH} characters`,
      });
    }

    // Optional limit, clamped to a safe range.
    let limit = DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        return res.status(400).json({
          error: `Limit must be an integer between 1 and ${MAX_LIMIT}`,
        });
      }
      limit = parsed;
    }

    // Mock-safe: with no API keys, return a clear, non-crashing response so the
    // app (and the create-recipe page) keeps working without Google credentials.
    if (!isImageSearchConfigured()) {
      return res.json({
        query: rawQuery,
        images: [],
        provider: PROVIDER,
        configured: false,
        cached: false,
        message:
          "Image search is not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to enable it.",
      });
    }

    const { images, cached } = await searchIngredientImages(rawQuery, limit);

    return res.json({
      query: rawQuery,
      images,
      provider: PROVIDER,
      configured: true,
      cached,
    });
  } catch (err) {
    // err.message for our own controlled errors is safe (no secrets); anything
    // unexpected falls back to a generic message.
    console.error("Image search error:", err.message);

    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }

    return res.status(500).json({ error: "Unable to search for images" });
  }
}
