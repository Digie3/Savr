import {
  isImageSearchConfigured,
  searchIngredientImages,
} from "../services/imageService.js";
import {
  getFallbackImages,
  renderFallbackSvg,
} from "../services/fallbackImageService.js";

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

    // No Google keys: fall back to built-in local image suggestions so the app
    // works out of the box. The frontend treats these like any other results.
    if (!isImageSearchConfigured()) {
      const images = getFallbackImages(rawQuery, limit);

      return res.json({
        query: rawQuery,
        images,
        provider: "fallback",
        configured: false,
        cached: false,
      });
    }

    const { images, cached } = await searchIngredientImages(rawQuery, limit);

    return res.json({
      query: rawQuery,
      images,
      provider: "google",
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

// GET /images/fallback/:file  (public — referenced directly by <img> tags)
// Serves the locally generated SVG tile for a fallback ingredient image.
export function serveFallbackImage(req, res) {
  const svg = renderFallbackSvg(req.params.file || "");
  res.set("Content-Type", "image/svg+xml");
  res.set("Cache-Control", "public, max-age=86400");
  return res.send(svg);
}
