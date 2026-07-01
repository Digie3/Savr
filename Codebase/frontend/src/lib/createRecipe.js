const BASE_URL = "http://localhost:4000";

function getToken() {
    return localStorage.getItem("savr_token");
}

export async function createRecipe(recipe) {
    const response = await fetch(`${BASE_URL}/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(recipe),
    });

    return response.json();
}

