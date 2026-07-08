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