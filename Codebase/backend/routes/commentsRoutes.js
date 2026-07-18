import express from "express";
import { requireAuth } from "../auth.js";
import {
    createComment,
    editComment,
    deleteComment,
} from "../controllers/commentsController.js";

const router = express.Router();

router.post("/recipes/:id/comments", requireAuth, createComment);
router.put("/recipes/:id/comments/:commentId", requireAuth, editComment);
router.delete("/recipes/:id/comments/:commentId", requireAuth, deleteComment);

export default router;