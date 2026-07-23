export async function getUserById(db, id) {
    return db.getAsync(
        `SELECT idUsers, username
        FROM Users
        WHERE idUsers = ?`,
        [id]
    );
}

export async function followUser(db, idFollower, idFollowed) {
    return db.runAsync(
        `INSERT INTO Followers
        (idFollower, idFollowed, followed_date)
        VALUES (?, ?, datetime('now'))`,
        [idFollower, idFollowed]
    );
}

export async function unfollowUser(db, idFollower, idFollowed) {
    return db.runAsync(
        `DELETE FROM Followers
        WHERE idFollower = ?
        AND idFollowed = ?`,
        [idFollower, idFollowed]
    );
}

export async function getFollowing(db, userId) {
    return db.allAsync(
        `SELECT
            Users.idUsers,
            Users.username,
            CASE
                WHEN Users.profile_image IS NOT NULL
                     AND length(Users.profile_image) > 0
                THEN '/users/' || Users.idUsers || '/profile-image'
                ELSE NULL
            END AS profileImageUrl,
            Followers.followed_date
        FROM Followers
        JOIN Users
            ON Followers.idFollowed = Users.idUsers
        WHERE Followers.idFollower = ?
        ORDER BY Followers.followed_date DESC`,
        [userId]
    );
}

export async function getFollowers(db, userId) {
    return db.allAsync(
        `SELECT
            Users.idUsers,
            Users.username,
            CASE
                WHEN Users.profile_image IS NOT NULL
                     AND length(Users.profile_image) > 0
                THEN '/users/' || Users.idUsers || '/profile-image'
                ELSE NULL
            END AS profileImageUrl,
            Followers.followed_date
        FROM Followers
        JOIN Users
            ON Followers.idFollower = Users.idUsers
        WHERE Followers.idFollowed = ?
        ORDER BY Followers.followed_date DESC`,
        [userId]
    );
}

export async function isFollowing(db, followerId, followedId) {
    return db.getAsync(
        `SELECT idFollower
        FROM Followers
        WHERE idFollower = ?
        AND idFollowed = ?`,
        [followerId, followedId]
    );
}

export async function getFollowCounts(db, userId) {

    const followersResult = await db.getAsync(
        `SELECT COUNT(*) AS count
        FROM Followers
        WHERE idFollowed = ?`,
        [userId]
    );

    const followingResult = await db.getAsync(
        `SELECT COUNT(*) AS count
        FROM Followers
        WHERE idFollower = ?`,
        [userId]
    );

    return {
        followersCount: followersResult.count,
        followingCount: followingResult.count,
    };

}