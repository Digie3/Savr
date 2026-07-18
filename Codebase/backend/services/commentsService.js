// Create Comment
export async function createCommentService(db, recipeId) {
    const recipe = await db.getAsync(
        `SELECT idRecipes FROM Recipes WHERE idRecipes = ?`,
        [recipeId]
    );

    if (!recipe) {
        return null;
    }

    return recipe;
}

export async function insertIntoComments(db, recipeId, userId, description) {
    const commentResult = await db.runAsync(
        `INSERT INTO Comments (Recipes_idRecipes, Users_idUsers, description, date_posted)
         VALUES (?, ?, ?, datetime('now'))`,
        [recipeId, userId, description]
    );

    if (!commentResult) {
        return null;
    }

    return commentResult;
}

// Edit Comment
export async function editCommentService(db, commentId) {
    const comment = await db.getAsync(
        `SELECT idComments, Users_idUsers, Recipes_idRecipes, date_posted
         FROM Comments WHERE idComments = ?`,
        [commentId]
    );

    if (!comment) {
        return null;
    }

    return comment;
}

export async function updateComments(db, description, commentId) {
    return await db.runAsync(
        `UPDATE Comments SET description = ? WHERE idComments = ?`,
        [description, commentId]
    );
}

// Delete Comment
export async function selectCommentDelete(db, commentId) {
    const comment = await db.getAsync(
        `SELECT idComments, Users_idUsers, Recipes_idRecipes
         FROM Comments WHERE idComments = ?`,
        [commentId]
    );

    if (!comment) {
        return null;
    }

    return comment;
}

export async function deleteSelectComment(db, commentId) {
    return await db.runAsync(`DELETE FROM Comments WHERE idComments = ?`, [commentId]);
}
