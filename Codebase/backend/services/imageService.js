// Image Service — ingredient image search via the Google Custom Search API.
//
// Configuration (see .env.example):
//   GOOGLE_SEARCH_API_KEY      Google Custom Search API key
//   GOOGLE_SEARCH_ENGINE_ID    Custom Search Engine ID (cx) with image search on
//   IMAGE_SEARCH_CACHE_TTL_MS  optional cache lifetime in ms (default 10 min)
//
// When the keys are missing the service reports itself as "not configured"
// (see isImageSearchConfigured) so the app still runs without Google credentials.

const GOOGLE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

function cacheTtlMs() {
  const configured = Number(process.env.IMAGE_SEARCH_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 10 * 60 * 1000;
}

// Simple in-memory cache: normalized "query::limit" -> { expires, data }.
const cache = new Map();

export function isImageSearchConfigured() {
  return Boolean(
    process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID
  );
}

function cacheKey(query, limit) {
  return `${query.toLowerCase()}::${limit}`;
}

// Map Google's response items into our stable, minimal image shape.
function mapItems(items = []) {
  return items
    .filter((item) => item && typeof item.link === "string")
    .map((item) => ({
      title: item.title || "",
      url: item.link,
      thumbnailUrl: item.image?.thumbnailLink || null,
      source: item.displayLink || null,
      contextLink: item.image?.contextLink || null,
    }));
}

export async function searchIngredientImages(query, limit) {
  const key = cacheKey(query, limit);
  const hit = cache.get(key);

  if (hit && hit.expires > Date.now()) {
    return { images: hit.data, cached: true };
  }

  // Build the request URL. The API key lives only in this URL — it is never
  // returned to the client and never logged.
  const url = new URL(GOOGLE_ENDPOINT);
  url.searchParams.set("key", process.env.GOOGLE_SEARCH_API_KEY);
  url.searchParams.set("cx", process.env.GOOGLE_SEARCH_ENGINE_ID);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", String(limit));
  url.searchParams.set("safe", "active");

  let response;
  try {
    response = await fetch(url);
  } catch {
    const err = new Error("Image search provider is unreachable");
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    // Log status only — never the URL (it contains the API key).
    console.error("Google Custom Search returned status", response.status);
    const err = new Error("Image search provider returned an error");
    err.status = 502;
    throw err;
  }

  const payload = await response.json();
  const images = mapItems(payload.items).slice(0, limit);

  cache.set(key, { expires: Date.now() + cacheTtlMs(), data: images });

  return { images, cached: false };
}

// Exposed for tests so cached results don't leak between cases.
export function clearImageSearchCache() {
  cache.clear();
}
