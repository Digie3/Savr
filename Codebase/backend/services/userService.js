export async function getPublicProfileById(db, userId) {
    const profile = await db.getAsync(
        `
        SELECT
          idUsers,
          username,
          country,
          gender,
          birthday,
          age,
          CASE
            WHEN profile_image IS NOT NULL THEN 1
            ELSE 0
          END AS hasProfileImage
        FROM Users
        WHERE idUsers = ?`,
        [userId]
    );

    if (!profile) {
        return null;
    }

    return {
        ...profile,
        hasProfileImage: Boolean(profile.hasProfileImage),
        profileImageUrl: profile.hasProfileImage
            ? `/users/${profile.idUsers}/profile-image`
            : null,
    };
}

export async function updateProfile(db, userId, profile) {
    await db.runAsync(
        `UPDATE Users
        SET
        username = ?,
        country = ?,
        gender = ?,
        birthday = ?,
        age = ?
        WHERE idUsers = ?`,
        [
            profile.username,
            profile.country,
            profile.gender,
            profile.birthday,
            profile.age,
            userId,
        ]
    );

    return getPublicProfileById(db, userId);
}

export async function usernameExists(db, username, userId) {
    return db.getAsync(
        `SELECT idUsers
        FROM Users
        WHERE username = ?
        AND idUsers != ?`,
        [username, userId]
    );
}

export async function saveProfileImage(db, userId, imageBuffer) {
    await db.runAsync(
        `UPDATE Users
        SET profile_image = ?
        WHERE idUsers = ?`,
        [imageBuffer, userId]
    );
}

export async function getProfileImage(db, userId) {
    return db.getAsync(
        `SELECT profile_image
        FROM Users
        WHERE idUsers = ?`,
        [userId]
    );
}