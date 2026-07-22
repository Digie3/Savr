import express from "express";
import { requireAuth } from "../auth.js";
import { searchImages } from "../controllers/imageController.js";

const router = express.Router();

// Ingredient image search, used by the authenticated Create Recipe flow.
router.get("/images/search", requireAuth, searchImages);

export default router;
