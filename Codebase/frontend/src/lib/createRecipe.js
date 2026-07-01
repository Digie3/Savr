const BASE_URL = "http://localhost:4000";

function getToken() {
    return localStorage.getItem("savr_token");
}

export async function createRecipe(formData) {
    const response = await fetch(`${BASE_URL}/create`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
    });

    return response.json();
}

