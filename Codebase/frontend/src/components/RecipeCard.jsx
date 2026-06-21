function RecipeCard({ title, creator, rating }) {
  return (
    <div>
      <h3>{title || "Recipe Title"}</h3>
      <p>By {creator || "Creator Name"}</p>
      <p>⭐ {rating || "No rating yet"}</p>
    </div>
  );
}

export default RecipeCard;