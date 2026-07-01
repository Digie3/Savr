import { useState } from "react";
import { createRecipe } from "../lib/createRecipe";

function CreateRecipeButton() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [prepTime, setPrepTime] = useState("");
    const [cookingTime, setCookingTime] = useState("");
    const [numServings, setNumServings] = useState("");
    const [recipeImage, setRecipeImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [ingredients, setIngredients] = useState([
        {
            name: "",
            quantity: "",
            unit: "",
            other_desc: "",
            image: null
        }
    ]);

    const [steps, setSteps] = useState([
        {
            text: "",
            image: null
        }
    ]);

    async function handleSubmit() {
        try {
            setLoading(true);

            const formData = new FormData();

            formData.append("title", title);
            formData.append("description", description);
            formData.append("prep_time", prepTime);
            formData.append("cooking_time", cookingTime);
            formData.append("num_servings", numServings);

            if (recipeImage) {
                formData.append("recipeImage", recipeImage);
            }

            ingredients.forEach((ingredient, index) => {
                formData.append(`ingredients[${index}][name]`, ingredient.name);
                formData.append(`ingredients[${index}][quantity]`, ingredient.quantity);
                formData.append(`ingredients[${index}][unit]`, ingredient.unit);
                formData.append(`ingredients[${index}][other_desc]`, ingredient.other_desc);

                if (ingredient.image) {
                    formData.append(`ingredients[${index}][image]`, ingredient.image);
                }
            }
            );

            steps.forEach((step, index) => {
                formData.append(`step_text_${index}`, step.text);

                if (step.image) {
                    formData.append(`step_image_${index}`, step.image);
                }
            });

            const data = await createRecipe(formData);

            if (data.error) {
                alert(data.error);
                return;
            }

            alert("Recipe created successfully!");
        }
        finally {
            setLoading(false);
        }

    }

    function addIngredient() {
        setIngredients([
            ...ingredients,
            {
                name: "",
                quantity: "",
                unit: "",
                other_desc: "",
                image: null
            }
        ]);
    }

    function updateIngredient(index, field, value) {
        const copy = [...ingredients];
        copy[index][field] = value;
        setIngredients(copy);
    }

    function addStep() {
        setSteps([
            ...steps,
            {
                text: "",
                image: null
            }
        ]);
    }

    function updateStep(index, field, value) {
        const copy = [...steps];
        copy[index][field] = value;
        setSteps(copy);
    }

    return (
        <div className="create-recipe-form">
            <div className="textbox">
                <label className="recipe-label">
                    Title
                </label>

                <textarea
                    maxLength={100}
                    placeholder="Enter Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                <div className="char-counter">
                    {title.length}/100
                </div>
            </div>

            <div className="form-section">
                <label>Recipe Image</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setRecipeImage(e.target.files[0])}
                />
            </div>

            <div className="textbox">
                <label className="recipe-label">
                    Description
                </label>

                <textarea
                    rows={7}
                    maxLength={1000}
                    placeholder="Enter Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <div className="char-counter">
                    {description.length}/1000
                </div>
            </div>

            <div className="form-section">
                <h3>Ingredients</h3>

                {ingredients.map((ingredient, index) => (
                    <div
                        key={index}
                        className="ingredient-card"
                    >
                        <input
                            type="text"
                            placeholder="Ingredient Name"
                            value={ingredient.name}
                            onChange={(e) => updateIngredient(index, "name", e.target.value)}
                        />

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Quantity"
                            value={ingredient.quantity}
                            onChange={(e) => updateIngredient(index, "quantity", e.target.value)}
                        />

                        <input
                            type="text"
                            placeholder="Unit"
                            value={ingredient.unit}
                            onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                        />

                        <input
                            type="text"
                            placeholder="Extra Description"
                            value={ingredient.other_desc}
                            onChange={(e) => updateIngredient(index, "other_desc", e.target.value)}
                        />

                        <label>Ingredient Image</label>

                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => updateIngredient(index, "image", e.target.files[0])}
                        />

                        {ingredients.length > 1 && (
                            <button
                                type="button"
                                onClick={() => { setIngredients(ingredients.filter((_, i) => i !== index)); }}
                            >
                                Remove Ingredient
                            </button>
                        )}
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addIngredient}
                >
                    Add Ingredient
                </button>
            </div>

            <div className="form-section">
                <h3>Recipe Steps</h3>

                {steps.map((step, index) => (
                    <div
                        key={index}
                        className="step-card"
                    >
                        <div className="step-card">
                            <div className="step-container">
                                <textarea
                                    maxLength={500}
                                    rows={8}
                                    placeholder={`Step ${index + 1}`}
                                    value={step.text}
                                    onChange={(e) => updateStep(index, "text", e.target.value)}
                                />

                                <div className="step-char-counter">
                                    {step.text.length}/500
                                </div>
                            </div>

                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                    updateStep(index, "image", e.target.files[0])
                                }
                            />
                        </div>

                        {steps.length > 1 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSteps(
                                        steps.filter(
                                            (_, i) => i !== index
                                        )
                                    );
                                }}
                            >
                                Remove Step
                            </button>
                        )}
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addStep}
                >
                    Add Step
                </button>
            </div>


            <div className="recipe-details">
                <input
                    type="number"
                    min="0"
                    placeholder="Preparation Time (mins)"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                />

                <input
                    type="number"
                    min="0"
                    placeholder="Cooking Time (mins)"
                    value={cookingTime}
                    onChange={(e) => setCookingTime(e.target.value)}
                />

                <input
                    type="number"
                    min="1"
                    placeholder="# of Servings"
                    value={numServings}
                    onChange={(e) => setNumServings(e.target.value)}
                />
            </div>

            <button
                disabled={loading}
                onClick={handleSubmit}
            >
                {loading
                    ? "Creating..."
                    : "Create Recipe"}
            </button>
        </div>
    );
}

export default CreateRecipeButton;