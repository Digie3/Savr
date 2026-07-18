import express from "express";
import { requireAuth } from "../auth.js";
import { follow, unfollow, following, followers, followStatus, counts} from "../controllers/followController.js";

const router = express.Router();

router.post("/follow/:idFollowed", requireAuth, follow);
router.delete("/follow/:idFollowed", requireAuth, unfollow);
router.get("/following/:userId", requireAuth, following);
router.get("/followers/:userId", requireAuth, followers);
router.get("/follow/status/:idFollowed", requireAuth, followStatus);
router.get("/follow/counts/:userId",requireAuth, counts);

export default router;