import { API_BASE } from "../api";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createComment(recipeId, description, token) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ description }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to post comment");
  }

  return response.json();
}

export async function updateComment(recipeId, commentId, description, token) {
  const response = await fetch(
    `${API_BASE}/recipes/${recipeId}/comments/${commentId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: JSON.stringify({ description }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to update comment");
  }

  return response.json();
}

export async function deleteComment(recipeId, commentId, token) {
  const response = await fetch(
    `${API_BASE}/recipes/${recipeId}/comments/${commentId}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to delete comment");
  }

  return response.json();
}

export async function submitRating(recipeId, stars, token) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}/rating`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ stars }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to submit rating");
  }

  return response.json();
}
