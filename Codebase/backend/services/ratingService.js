export async function getRecipeByIdService(db, recipeId) {
    const recipe = await db.getAsync(
        `SELECT idRecipes FROM Recipes WHERE idRecipes = ?`,
        [recipeId]
    );

    return recipe;
}

export async function submitRatingService(db, recipeId, userId, stars) {
    return await db.runAsync(
        `INSERT INTO Ratings (Recipes_idRecipes, Users_idUsers, num_stars, date_posted)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(Recipes_idRecipes, Users_idUsers) DO UPDATE SET
           num_stars = excluded.num_stars,
           date_posted = datetime('now')`,
        [recipeId, userId, stars]
    );
}

export async function getRatingSummaryService(db, recipeId) {
    return await db.getAsync(
        `SELECT ROUND(AVG(num_stars), 1) AS averageRating, COUNT(*) AS ratingCount
         FROM Ratings
         WHERE Recipes_idRecipes = ?`,
        [recipeId]
    );
}