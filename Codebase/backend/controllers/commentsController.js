import { getDB } from "../db.js";
import { logActivity } from "../lakehouse/lakehouse.js";
import {
    createCommentService,
    insertIntoComments,
    editCommentService,
    selectCommentDelete,
    updateComments,
    deleteSelectComment
} from "../services/commentsService.js";

// Comments longer than this are rejected on both create and edit.
const MAX_COMMENT_LENGTH = 1000;

export async function createComment(req, res) {
    try {
        const db = getDB();
        const recipeId = Number(req.params.id);
        const description = (req.body?.description || "").trim();

        if (!recipeId) {
            return res.status(400).json({ error: "Invalid recipe id" });
        }

        if (!description) {
            return res.status(400).json({ error: "Comment cannot be empty" });
        }

        if (description.length > MAX_COMMENT_LENGTH) {
            return res.status(400).json({
                error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
            });
        }

        const recipe = await createCommentService(db, recipeId);

        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }

        const commentResult = await insertIntoComments(db, recipeId, req.user.id, description);

        await logActivity(db, {
            userId: req.user.id,
            username: req.user.username,
            eventType: "comment_create",
            entityType: "comment",
            entityId: commentResult.lastID,
            metadata: { route: "/recipes/:id/comments" },
        });

        return res.status(201).json({
            message: "Comment posted successfully",
            comment: {
                id: commentResult.lastID,
                description,
                creatorId: req.user.id,
                creatorName: req.user.username,
                datePosted: new Date().toISOString(),
            },
        });

    } catch (err) {
        console.error("Comment create error:", err);
        return res.status(500).json({ error: "Unable to post comment" });
    }
}

export async function editComment(req, res) {
    try {
        const db = getDB();
        const recipeId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        const description = (req.body?.description || "").trim();

        if (!recipeId || !commentId) {
            return res.status(400).json({ error: "Invalid recipe or comment id" });
        }

        if (!description) {
            return res.status(400).json({ error: "Comment cannot be empty" });
        }

        if (description.length > MAX_COMMENT_LENGTH) {
            return res.status(400).json({
                error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
            });
        }

        const comment = await editCommentService(db, commentId);

        if (!comment || comment.Recipes_idRecipes !== recipeId) {
            return res.status(404).json({ error: "Comment not found" });
        }

        if (comment.Users_idUsers !== req.user.id) {
            return res.status(403).json({ error: "You can only edit your own comment" });
        }

        await updateComments(db, description, commentId);

        await logActivity(db, {
            userId: req.user.id,
            username: req.user.username,
            eventType: "comment_edit",
            entityType: "comment",
            entityId: commentId,
            metadata: { route: "/recipes/:id/comments/:commentId" },
        });

        return res.json({
            message: "Comment updated successfully",
            comment: {
                id: commentId,
                description,
                creatorId: req.user.id,
                creatorName: req.user.username,
                datePosted: comment.date_posted,
            },
        });

    } catch (err) {
        console.error("Comment edit error:", err);
        return res.status(500).json({ error: "Unable to update comment" });
    }
}

export async function deleteComment(req, res) {
    try {
        const db = getDB();
        const recipeId = Number(req.params.id);
        const commentId = Number(req.params.commentId);

        if (!recipeId || !commentId) {
            return res.status(400).json({ error: "Invalid recipe or comment id" });
        }

        const comment = await selectCommentDelete(db, commentId);

        if (!comment || comment.Recipes_idRecipes !== recipeId) {
            return res.status(404).json({ error: "Comment not found" });
        }

        if (comment.Users_idUsers !== req.user.id) {
            return res.status(403).json({ error: "You can only delete your own comment" });
        }

        await deleteSelectComment(db, commentId);

        await logActivity(db, {
            userId: req.user.id,
            username: req.user.username,
            eventType: "comment_delete",
            entityType: "comment",
            entityId: commentId,
            metadata: { route: "/recipes/:id/comments/:commentId" },
        });

        return res.json({ message: "Comment deleted successfully", id: commentId });

    } catch (err) {
        console.error("Comment delete error:", err);
        return res.status(500).json({ error: "Unable to delete comment" });
    }
}