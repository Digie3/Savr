import { API_BASE } from "../api";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function buildMediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  return `${API_BASE}${path}`;
}

export async function fetchRecipes(token) {
  const response = await fetch(`${API_BASE}/recipes`, {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Unable to load recipes");
  }

  return response.json();
}

export async function fetchRecipeDetail(recipeId, token) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Unable to load recipe");
  }

  return response.json();
}

export async function fetchSavedRecipes(token) {
  const response = await fetch(`${API_BASE}/saved-recipes`, {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Unable to load saved recipes");
  }

  return response.json();
}

export async function saveRecipe(recipeId, token) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}/save`, {
    method: "POST",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Unable to save recipe");
  }

  return response.json();
}

export async function unsaveRecipe(recipeId, token) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}/save`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Unable to remove saved recipe");
  }

  return response.json();
}

export async function deleteRecipe(recipeId, token) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Unable to delete recipe");
  }

  return data;
}
