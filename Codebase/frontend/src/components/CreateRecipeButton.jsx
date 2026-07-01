import { useState } from "react";
import { createRecipe } from "../lib/createRecipe";

function CreateRecipeButton() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [instructions, setInstructions] = useState("");
    const [prepTime, setPrepTime] = useState("");
    const [cookingTime, setCookingTime] = useState("");
    const [numServings, setNumServings] = useState("");

    async function handleSubmit() {
        const data = await createRecipe({
            title,
            description,
            instructions,
            prep_time: Number(prepTime),
            cooking_time: Number(cookingTime),
            num_servings: Number(numServings),
        });

        if (data.error) {
            alert(data.error);
            return;
        }

        alert("Recipe created successfully!");
    }

    return (
        <div>
            <input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />

            <input
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />

            <textarea
                placeholder="Instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
            />

            <input
                type="number"
                placeholder="Prep Time"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
            />

            <input
                type="number"
                placeholder="Cooking Time"
                value={cookingTime}
                onChange={(e) => setCookingTime(e.target.value)}
            />

            <input
                type="number"
                placeholder="Number of Servings"
                value={numServings}
                onChange={(e) => setNumServings(e.target.value)}
            />

            <button onClick={handleSubmit}>
                Create Recipe
            </button>
        </div>
    );
}

export default CreateRecipeButton;