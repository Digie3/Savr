export async function getSavedRecipesService(db, userId) {
    const recipes = await db.allAsync(
        `
          SELECT
            Recipes.idRecipes AS id,
            Recipes.title,
            Recipes.description,
            Recipes.prep_time AS prepTime,
            Recipes.cooking_time AS cookingTime,
            Recipes.num_servings AS numServings,
            Recipes.date_posted AS datePosted,
            Users.idUsers AS creatorId,
            Users.username AS creatorName,
            CASE
              WHEN Users.profile_image IS NOT NULL THEN '/users/' || Users.idUsers || '/profile-image'
              ELSE NULL
            END AS creatorProfileImageUrl,
            SavedRecipes.bookmarked_date AS bookmarkedDate,
            1 AS isSaved,
            (
              SELECT Media.media_url
              FROM RecipeMedia
              JOIN Media ON RecipeMedia.Media_idMedia = Media.idMedia
              WHERE RecipeMedia.Recipes_idRecipes = Recipes.idRecipes
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl,
            (
              SELECT COUNT(*)
              FROM Comments
              WHERE Comments.Recipes_idRecipes = Recipes.idRecipes
            ) AS commentCount,
            (
              SELECT ROUND(AVG(Ratings.num_stars), 1)
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
            ) AS averageRating
          FROM SavedRecipes
          JOIN Recipes ON SavedRecipes.Recipes_idRecipes = Recipes.idRecipes
          JOIN Users ON Recipes.Users_idUsers = Users.idUsers
          WHERE SavedRecipes.Users_idUsers = ?
          ORDER BY datetime(SavedRecipes.bookmarked_date) DESC, Recipes.idRecipes DESC
        `,
        [userId]
    );

    return recipes;
}

export async function saveRecipeService(db, recipeId) {
    const recipe = await db.getAsync(
        `SELECT idRecipes FROM Recipes WHERE idRecipes = ?`,
        [recipeId]
    );

    if (!recipe) {
        return null;
    }

    return recipe;
}

export async function insertSavedRecipeService(db, userId, recipeId) {
    await db.runAsync(
        `INSERT OR IGNORE INTO SavedRecipes
         (Users_idUsers, Recipes_idRecipes, bookmarked_date)
         VALUES (?, ?, datetime('now'))`,
        [userId, recipeId]
    );

    return { saved: true };
}

// DELETE save recipe
export async function unsaveRecipeService(db, userId, recipeId) {

    await db.runAsync(
        `DELETE FROM SavedRecipes
         WHERE Users_idUsers = ? AND Recipes_idRecipes = ?`,
        [userId, recipeId]
    );

    return { saved: false };
}