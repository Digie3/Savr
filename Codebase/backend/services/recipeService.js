import { cleanupUploadedFiles } from "../helpers/imageHelper.js";

// Recipe Service - POST recipe
export async function createRecipeService(db, req) {
    let transactionStarted = false;

    try {
        // Start the transaction into db
        await db.runAsync("BEGIN TRANSACTION");
        transactionStarted = true;

        const {
            title,
            description,
            prep_time,
            cooking_time,
            num_servings,
            ingredients: submittedIngredients = [],
        } = req.body;
        
        //Convertion into a Number
        const prepTime = Number(prep_time);
        const cookingTime = Number(cooking_time);
        const numServings = Number(num_servings);

        const stepKeys = Object.keys(req.body).filter((key) => key.startsWith("step_text_"));

        // RECIPE
        const userId = req.user.id;
        const recipe = await db.runAsync(
            `INSERT INTO Recipes
        (Users_idUsers, title, description,
         prep_time, cooking_time, num_servings, date_posted)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                userId,
                title,
                description || null,
                prepTime,
                cookingTime,
                numServings
            ]
        );

        const recipeId = recipe.lastID;

        // RECIPE IMAGE
        const recipeImage = req.files.find(file => file.fieldname === "recipeImage");
        if (recipeImage) {
            const media = await db.runAsync(
                `INSERT INTO Media
          (media_url, media_type, upload_date)
          VALUES (?, 'recipe', datetime('now'))`,
                [
                    `/uploads/user_${req.user.id}/recipes/${recipeImage.filename}`
                ]
            );

            await db.runAsync(
                `INSERT INTO RecipeMedia
          (Media_idMedia, Recipes_idRecipes)
          VALUES (?, ?)`,
                [
                    media.lastID,
                    recipeId
                ]
            );
        }

        // INGREDIENTS
        for (let i = 0; i < submittedIngredients.length; i++) {
            const currIngredient = submittedIngredients[i];
            const name = currIngredient.name;
            const quantity = Number(currIngredient.quantity);
            const unit = currIngredient.unit;
            const otherDesc = currIngredient.other_desc;

            let ingredient = await db.getAsync(
                `SELECT idIngredients
          FROM Ingredients
          WHERE name = ?`,
                [name]
            );

            let ingredientId;

            if (!ingredient) {
                const result = await db.runAsync(
                    `INSERT INTO Ingredients
            (name)
            VALUES(?)`,
                    [name]
                );

                ingredientId = result.lastID;
            }
            else {
                ingredientId = ingredient.idIngredients;
            }

            await db.runAsync(
                `INSERT INTO Recipes_has_Ingredients
          (Recipes_idRecipes, Ingredients_idIngredients, quantity, unit, other_desc)
          VALUES(?, ?, ?, ?, ?)`,
                [
                    recipeId,
                    ingredientId,
                    quantity,
                    unit,
                    otherDesc || null
                ]
            );

            const ingredientImage = req.files.find(file => file.fieldname === `ingredients[${i}][image]`);

            if (ingredientImage) {
                const media = await db.runAsync(
                    `INSERT INTO Media
            (media_url, media_type, upload_date)
            VALUES(?, 'ingredient', datetime('now'))`,
                    [
                        `/uploads/user_${req.user.id}/ingredients/${ingredientImage.filename}`
                    ]
                );

                await db.runAsync(
                    `INSERT INTO IngredientMedia
            (Media_idMedia, Ingredients_idIngredients)
            VALUES(?, ?)`,
                    [
                        media.lastID,
                        ingredientId
                    ]
                );
            }
        }

        //RECIPE STEPS
        for (const key of stepKeys) {
            const stepIndex = Number(key.replace("step_text_", ""));
            const stepText = req.body[key];

            const stepResult = await db.runAsync(
                `INSERT INTO RecipeSteps
          (Recipes_idRecipes, step_number, instruction_text)
          VALUES(?, ?, ?)`,
                [
                    recipeId,
                    stepIndex + 1,
                    stepText
                ]
            );

            const stepId = stepResult.lastID;

            const stepImage = req.files.find(file => file.fieldname === `step_image_${stepIndex}`);

            if (stepImage) {
                const media = await db.runAsync(
                    `INSERT INTO Media
            (media_url, media_type, upload_date)
            VALUES(?, 'step', datetime('now'))`,
                    [
                        `/uploads/user_${req.user.id}/steps/${stepImage.filename}`
                    ]
                );

                await db.runAsync(
                    `INSERT INTO RecipeStepMedia
            (Media_idMedia, RecipeSteps_idRecipeSteps)
            VALUES(?, ?)`,
                    [
                        media.lastID,
                        stepId
                    ]
                );
            }
        }

        // COMMIT into db
        await db.runAsync("COMMIT");
        return {
            message: "Posted Recipe successfully",
            recipeId,
        };
    } catch (err) {
        cleanupUploadedFiles(req.files);

        if (transactionStarted) {
            await db.runAsync("ROLLBACK");
        }

        throw err;
    }
}

export async function getAllRecipes(db, viewerId) {

    return await db.allAsync(`
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
          ) AS averageRating,
          CASE
            WHEN ? IS NOT NULL AND EXISTS (
              SELECT 1
              FROM SavedRecipes
              WHERE SavedRecipes.Recipes_idRecipes = Recipes.idRecipes
                AND SavedRecipes.Users_idUsers = ?
            )
            THEN 1
            ELSE 0
          END AS isSaved
        FROM Recipes
        JOIN Users ON Recipes.Users_idUsers = Users.idUsers
        ORDER BY datetime(Recipes.date_posted) DESC, Recipes.idRecipes DESC
      `, [viewerId, viewerId]);
}

export async function getRecipeById(db, recipeId, viewerId) {

    const recipe = await db.getAsync(
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
            (
              SELECT Media.media_url
              FROM RecipeMedia
              JOIN Media ON RecipeMedia.Media_idMedia = Media.idMedia
              WHERE RecipeMedia.Recipes_idRecipes = Recipes.idRecipes
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl,
            (
              SELECT ROUND(AVG(Ratings.num_stars), 1)
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
            ) AS averageRating,
            (
              SELECT COUNT(*)
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
            ) AS ratingCount,
            (
              SELECT num_stars
              FROM Ratings
              WHERE Ratings.Recipes_idRecipes = Recipes.idRecipes
                AND Ratings.Users_idUsers = ?
            ) AS userRating,
            CASE
              WHEN ? IS NOT NULL AND EXISTS (
                SELECT 1
                FROM SavedRecipes
                WHERE SavedRecipes.Recipes_idRecipes = Recipes.idRecipes
                  AND SavedRecipes.Users_idUsers = ?
              )
              THEN 1
              ELSE 0
            END AS isSaved
          FROM Recipes
          JOIN Users ON Recipes.Users_idUsers = Users.idUsers
          WHERE Recipes.idRecipes = ?
        `,
        [viewerId, viewerId, viewerId, recipeId]
    );

    return recipe;
}

export async function getRecipeIngredients(db, recipeId) {

    const ingredients = await db.allAsync(
        `
          SELECT
            Ingredients.idIngredients AS id,
            Ingredients.name,
            Recipes_has_Ingredients.quantity,
            Recipes_has_Ingredients.unit,
            Recipes_has_Ingredients.other_desc AS otherDesc,
            (
              SELECT Media.media_url
              FROM IngredientMedia
              JOIN Media ON IngredientMedia.Media_idMedia = Media.idMedia
              WHERE IngredientMedia.Ingredients_idIngredients = Ingredients.idIngredients
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl
          FROM Recipes_has_Ingredients
          JOIN Ingredients
            ON Recipes_has_Ingredients.Ingredients_idIngredients = Ingredients.idIngredients
          WHERE Recipes_has_Ingredients.Recipes_idRecipes = ?
          ORDER BY Ingredients.name ASC
        `,
        [recipeId]
    );

    return ingredients;
}

export async function getRecipeSteps(db, recipeId) {

    const steps = await db.allAsync(
        `
          SELECT
            RecipeSteps.idRecipeSteps AS id,
            RecipeSteps.step_number AS stepNumber,
            RecipeSteps.instruction_text AS instructionText,
            (
              SELECT Media.media_url
              FROM RecipeStepMedia
              JOIN Media ON RecipeStepMedia.Media_idMedia = Media.idMedia
              WHERE RecipeStepMedia.RecipeSteps_idRecipeSteps = RecipeSteps.idRecipeSteps
              ORDER BY Media.display_order ASC, Media.idMedia ASC
              LIMIT 1
            ) AS imageUrl
          FROM RecipeSteps
          WHERE RecipeSteps.Recipes_idRecipes = ?
          ORDER BY RecipeSteps.step_number ASC
        `,
        [recipeId]
    );

    return steps;
}

export async function getRecipeComments(db, recipeId) {

    const comments = await db.allAsync(
        `
          SELECT
            Comments.idComments AS id,
            Comments.description,
            Comments.date_posted AS datePosted,
            Users.idUsers AS creatorId,
            Users.username AS creatorName
          FROM Comments
          JOIN Users ON Comments.Users_idUsers = Users.idUsers
          WHERE Comments.Recipes_idRecipes = ?
          ORDER BY datetime(Comments.date_posted) DESC, Comments.idComments DESC
        `,
        [recipeId]
    );

    return comments;
}

export async function deleteRecipeService(db, recipeId, userId) {
    const recipe = await db.getAsync(
        `
          SELECT idRecipes, Users_idUsers
          FROM Recipes
          WHERE idRecipes = ?
        `,
        [recipeId]
    );

    if (!recipe) {
        const err = new Error("Recipe not found");
        err.status = 404;
        err.body = { error: "Recipe not found" };
        throw err;
    }

    if (recipe.Users_idUsers !== userId) {
        const err = new Error("You can only delete your own recipes");
        err.status = 403;
        err.body = { error: "You can only delete your own recipes" };
        throw err;
    }

    const mediaRows = await db.allAsync(
        `
          SELECT DISTINCT Media.idMedia AS id, Media.media_url AS mediaUrl
          FROM Media
          JOIN RecipeMedia ON RecipeMedia.Media_idMedia = Media.idMedia
          WHERE RecipeMedia.Recipes_idRecipes = ?

          UNION

          SELECT DISTINCT Media.idMedia AS id, Media.media_url AS mediaUrl
          FROM Media
          JOIN RecipeStepMedia ON RecipeStepMedia.Media_idMedia = Media.idMedia
          JOIN RecipeSteps ON RecipeStepMedia.RecipeSteps_idRecipeSteps = RecipeSteps.idRecipeSteps
          WHERE RecipeSteps.Recipes_idRecipes = ?
        `,
        [recipeId, recipeId]
    );

    const mediaIds = mediaRows.map((row) => row.id);

    await db.runAsync("BEGIN TRANSACTION");

    try {
        await db.runAsync(`DELETE FROM SavedRecipes WHERE Recipes_idRecipes = ?`, [recipeId]);
        await db.runAsync(`DELETE FROM Comments WHERE Recipes_idRecipes = ?`, [recipeId]);
        await db.runAsync(`DELETE FROM Ratings WHERE Recipes_idRecipes = ?`, [recipeId]);
        await db.runAsync(`DELETE FROM Recipes_has_Ingredients WHERE Recipes_idRecipes = ?`, [recipeId]);
        await db.runAsync(`DELETE FROM RecipeMedia WHERE Recipes_idRecipes = ?`, [recipeId]);
        await db.runAsync(
            `
              DELETE FROM RecipeStepMedia
              WHERE RecipeSteps_idRecipeSteps IN (
                SELECT idRecipeSteps
                FROM RecipeSteps
                WHERE Recipes_idRecipes = ?
              )
            `,
            [recipeId]
        );
        await db.runAsync(`DELETE FROM RecipeSteps WHERE Recipes_idRecipes = ?`, [recipeId]);
        await db.runAsync(`DELETE FROM Recipes WHERE idRecipes = ?`, [recipeId]);

        if (mediaIds.length > 0) {
            const placeholders = mediaIds.map(() => "?").join(",");
            await db.runAsync(`DELETE FROM Media WHERE idMedia IN (${placeholders})`, mediaIds);
        }

        await db.runAsync("COMMIT");

        return {
            recipeId,
            deletedMediaUrls: mediaRows.map((row) => row.mediaUrl).filter(Boolean),
        };
    } catch (err) {
        await db.runAsync("ROLLBACK");
        throw err;
    }
}
