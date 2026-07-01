import CreateRecipeButton from "../components/CreateRecipeButton";
import bckImg from "../assets/create-recipe-bck.jpg";

function CreateRecipe() {
  return (
    <div className="create-recipe"
    style={{ backgroundImage: `url(${bckImg})` }}
    >
      <div className="create-recipe-overlay"></div>

      <div className="create-recipe-page">
        <h1>Create Recipe</h1>

        <CreateRecipeButton />
      </div>
    </div>

  );
}

export default CreateRecipe;