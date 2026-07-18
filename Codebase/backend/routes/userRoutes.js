import express from "express";
import { requireAuth } from "../auth.js";
import profileImageUpload from "../middleware/profileImageUpload.js";
import { getMyProfile, getOtherUserProfile, editProfile, uploadProfileImage, getUserImage } from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", requireAuth, getMyProfile);
router.get("/users/:id/profile", requireAuth, getOtherUserProfile);
router.put("/profile", requireAuth, editProfile);
router.post("/profile/image", requireAuth, profileImageUpload.single("profileImage"), uploadProfileImage);
router.get("/users/:id/profile-image", getUserImage);

export default router;