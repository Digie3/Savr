import { API_BASE } from "../api";

export function buildMediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  return `${API_BASE}${path}`;
}

export async function fetchRecipes() {
  const response = await fetch(`${API_BASE}/recipes`);

  if (!response.ok) {
    throw new Error("Unable to load recipes");
  }

  return response.json();
}

export async function fetchRecipeDetail(recipeId) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}`);

  if (!response.ok) {
    throw new Error("Unable to load recipe");
  }

  return response.json();
}
