import { getImageMimeType } from "../helpers/imageHelper.js";
import { getDB } from "../db.js";
import {
    getPublicProfileById,
    updateProfile,
    usernameExists,
    saveProfileImage,
    getProfileImage
} from "../services/userService.js";

export async function getMyProfile(req, res) {
    try {
        const db = getDB();
        const profile = await getPublicProfileById(db, req.user.id);

        if (!profile) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.json(profile);

    } catch (err) {

        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function getOtherUserProfile(req, res) {
    try {
        const db = getDB();
        const userId = Number(req.params.id);

        if (!userId) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        const profile = await getPublicProfileById(db, userId);

        if (!profile) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.json(profile);

    } catch (err) {

        console.error("Public profile fetch error:", err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function editProfile(req, res) {
    try {
        const db = getDB();
        const {
            username,
            country,
            gender,
            birthday,
            age,
        } = req.body;

        if (!username || username.trim() === "") {
            return res.status(400).json({
                error: "Username is required",
            });
        }

        if (
            gender &&
            !["male", "female", "other"].includes(gender)
        ) {
            return res.status(400).json({
                error: "Invalid gender",
            });
        }

        if (age !== null && age !== undefined) {
            const parsedAge = Number(age);

            if (!Number.isInteger(parsedAge) || parsedAge < 16) {
                return res.status(400).json({
                    error: "Age must be at least 16",
                });
            }
        }

        const existing = await usernameExists(db, username.trim(), req.user.id);

        if (existing) {
            return res.status(409).json({
                error: "Username already exists",
            });
        }

        const updated = await updateProfile(
            db,
            req.user.id,
            {
                username: username.trim(),
                country: country || null,
                gender: gender || null,
                birthday: birthday || null,
                age: age || null,
            }
        );

        return res.json(updated);

    } catch (err) {

        console.error("Profile update error:", err);

        return res.status(500).json({
            error: "Server error",
        });
    }
}

export async function uploadProfileImage(req, res) {
    try {
        const db = getDB();

        if (!req.file) {
            return res.status(400).json({
                error: "No profile image uploaded",
            });
        }

        await saveProfileImage(db, req.user.id, req.file.buffer);

        const updated = await getPublicProfileById(db, req.user.id);

        return res.json(updated);

    } catch (dbErr) {

        console.error("Profile image upload error:", dbErr);
        return res.status(500).json({
            error: "Unable to upload profile image",
        });
    }
}

export async function getUserImage(req, res) {
    try {
        const db = getDB();
        const userId = Number(req.params.id);

        if (!userId) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        const row = await getProfileImage(db, userId);

        if (!row || !row.profile_image) {
            return res.status(404).json({ error: "Profile image not found" });
        }

        const contentType = getImageMimeType(row.profile_image);

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=3600");

        return res.send(row.profile_image);
    }
    catch (err) {

        console.error("Profile image fetch error:", err);
        return res.status(500).json({ error: "Unable to load profile image" });
    }
}