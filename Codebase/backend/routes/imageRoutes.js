import express from "express";
import { requireAuth } from "../auth.js";
import { searchImages, serveFallbackImage } from "../controllers/imageController.js";

const router = express.Router();

// Ingredient image search, used by the authenticated Create Recipe flow.
router.get("/images/search", requireAuth, searchImages);

// Locally generated fallback image tiles. Public because <img> tags load them
// directly (no auth header) and they contain no private data.
router.get("/images/fallback/:file", serveFallbackImage);

export default router;
