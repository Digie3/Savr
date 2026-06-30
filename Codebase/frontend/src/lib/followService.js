const BASE_URL = "http://localhost:4000";

function getToken() {
  return localStorage.getItem("savr_token");
}

export async function followUser(userId) {
  const response = await fetch(`${BASE_URL}/follow/${userId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  return response.json();
}

export async function unfollowUser(userId) {
  const response = await fetch(`${BASE_URL}/follow/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  return response.json();
}