import { API_BASE } from "../api";

export async function getProfile(token) {
  const response = await fetch(`${API_BASE}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load profile");
  }

  return response.json();
}

export async function updateProfile(token, profile) {
  const response = await fetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update profile");
  }

  return response.json();
}
export async function getUserProfile(token, userId) {
  const response = await fetch(`${API_BASE}/users/${userId}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to load user profile");
  }

  return response.json();
}
export async function uploadProfileImage(token, imageFile) {
  const formData = new FormData();
  formData.append("profileImage", imageFile);

  const response = await fetch(`${API_BASE}/profile/image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload profile image");
  }

  return response.json();
}