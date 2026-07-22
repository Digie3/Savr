import { API_BASE } from "../api";

// Calls the backend Image Service to fetch suggested images for an ingredient.
// Returns the raw payload: { query, images, provider, configured, cached, message? }.
export async function searchIngredientImages(ingredient, token, limit) {
  const params = new URLSearchParams({ ingredient });
  if (limit) params.set("limit", String(limit));

  const response = await fetch(`${API_BASE}/images/search?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Unable to search for images");
  }

  return data;
}
