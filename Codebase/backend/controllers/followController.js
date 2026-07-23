import { getUserById, followUser, unfollowUser, getFollowing, getFollowers, isFollowing, getFollowCounts } from "../services/followService.js";
import { logActivity } from "../lakehouse/lakehouse.js";
import { getDB } from "../db.js";

export async function follow(req, res) {
    try {
        const db = getDB();
        const idFollower = req.user.id;
        const idFollowed = Number(req.params.idFollowed);

        if (!idFollowed) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        if (idFollower === idFollowed) {
            return res.status(400).json({ error: "You cannot follow yourself" });
        }

        const userToFollow = await getUserById(db, idFollowed);

        if (!userToFollow) {
            return res.status(404).json({ error: "User not found" });
        }

        await followUser(db, idFollower, idFollowed);

        await logActivity(db, {
            userId: idFollower,
            username: req.user.username,
            eventType: "follow",
            entityType: "user",
            entityId: idFollowed,
            metadata: { route: "/follow/:idFollowed" },
        });

        return res.status(201).json({
            message: "User followed successfully",
            followedUser: userToFollow,
        });

    } catch (err) {

        if (err && err.message && err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Already following this user" });
        }

        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function unfollow(req, res) {
    try {
        const db = getDB();
        const idFollower = req.user.id;
        const idFollowed = Number(req.params.idFollowed);

        if (!idFollowed) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        await unfollowUser(db, idFollower, idFollowed);

        await logActivity(db, {
            userId: idFollower,
            username: req.user.username,
            eventType: "unfollow",
            entityType: "user",
            entityId: idFollowed,
            metadata: { route: "/follow/:idFollowed" }
        });

        return res.json({ message: "User unfollowed successfully" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function following(req, res) {
    try {
        const db = getDB();
        const userId = Number(req.params.userId);
        const following = await getFollowing(db, userId);

        return res.json({ following });

    } catch (err) {

        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function followers(req, res) {
    try {
        const db = getDB();
        const userId = Number(req.params.userId);
        const followers = await getFollowers(db, userId);

        return res.json({ followers });

    } catch (err) {

        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function followStatus(req, res) {
    try {
        const db = getDB();
        const idFollower = req.user.id;
        const idFollowed = Number(req.params.idFollowed);

        if (!idFollowed) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        const follow = await isFollowing(db, idFollower, idFollowed);

        return res.json({ isFollowing: Boolean(follow) });

    } catch (err) {

        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function counts(req, res) {
    try {
        const db = getDB();
        const userId = Number(req.params.userId);

        if (!userId) {
            return res.status(400).json({ error: "Invalid user id" });
        }

        const counts = await getFollowCounts(db, userId);

        return res.json(counts);

    } catch (err) {

        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
}

export async function followingFeed(req, res) {
  try {
    const db = getDB();
    const loggedInUserId = req.user.id;

    const recipes = await db.allAsync(
      `
      SELECT
        r.idRecipes AS id,
        r.Users_idUsers AS creatorId,
        r.title,
        r.description,
        r.prep_time AS prepTime,
        r.cooking_time AS cookingTime,
        r.num_servings AS numServings,
        r.date_posted AS datePosted,
        u.username AS creatorName,
NULL AS creatorProfileImageUrl      FROM Recipes r
      JOIN Followers f
        ON f.idFollowed = r.Users_idUsers
      JOIN Users u
        ON u.idUsers = r.Users_idUsers
      WHERE f.idFollower = ?
      ORDER BY r.date_posted DESC
      `,
      [loggedInUserId]
    );

  

    return res.json({ recipes });
  } catch (err) {

    return res.status (500).json({
      error: "Failed to load recipes from followed users",
    });
  }
}