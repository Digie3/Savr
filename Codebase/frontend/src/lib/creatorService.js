const BASE_URL = "http://localhost:4000";

function getToken() {
    return localStorage.getItem("savr_token");
}

export async function fetchCreatorDashboard(username) {

    const response = await fetch(
        `${BASE_URL}/creator/dashboard/${username}`,
        {
            headers: {
                Authorization: `Bearer ${getToken()}`
            }
        }
    );

    if (!response.ok) {
        throw new Error("Unable to load creator dashboard");
    }

    return response.json();
}