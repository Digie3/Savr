import express from "express";
import {register, login, me, logout} from "../controllers/authController.js";
import { requireAuth } from "../auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

export default router;

