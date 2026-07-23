import { API_BASE } from "../api";

function getToken() {
  return localStorage.getItem("savr_token");
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function followUser(userId) {
  const response = await fetch(`${API_BASE}/follow/${userId}`, {
    method: "POST",
    headers: authHeaders(),
  });

  return response.json();
}

export async function unfollowUser(userId) {
  const response = await fetch(`${API_BASE}/follow/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  return response.json();
}

export async function getFollowStatus(userId) {
  const response = await fetch(`${API_BASE}/follow/status/${userId}`, {
    headers: authHeaders(),
  });

  return response.json();
}

export async function getFollowCounts(userId) {
  const response = await fetch(`${API_BASE}/follow/counts/${userId}`, {
    headers: authHeaders(),
  });

  return response.json();
}
export async function getFollowers(userId) {
  const response = await fetch(`${API_BASE}/followers/${userId}`, {
    headers: authHeaders(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Unable to load followers");
  }

  return data;
}

export async function getFollowing(userId) {
  const response = await fetch(`${API_BASE}/following/${userId}`, {
    headers: authHeaders(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Unable to load following");
  }

  return data;
}