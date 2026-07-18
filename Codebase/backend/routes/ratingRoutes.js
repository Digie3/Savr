import express from "express";
import { requireAuth } from "../auth.js";
import { submitRating } from "../controllers/ratingController.js";

const router = express.Router();

router.post("/recipes/:id/rating", requireAuth, submitRating);

export default router;