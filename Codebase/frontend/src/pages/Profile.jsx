import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import FollowButton from "../components/FollowButton";
import RecipeCard from "../components/RecipeCard";
import { useAuth } from "../auth/useAuth";
import {
  getFollowCounts,
  getFollowers,
  getFollowing,
} from "../lib/followService";
import {
  getProfile,
  getUserProfile,
  updateProfile,
  uploadProfileImage,
} from "../lib/profileService";
import {
  fetchRecipes,
  saveRecipe,
  unsaveRecipe,
} from "../lib/recipes";
import { API_BASE } from "../api";

function normalizeBirthday(value) {
  if (!value) return "";

  return String(value).slice(0, 10);
}

function calculateAge(birthday) {
  if (!birthday) return "";

  const normalizedBirthday = normalizeBirthday(birthday);
  const [year, month, day] = normalizedBirthday.split("-").map(Number);

  if (!year || !month || !day) return "";

  const today = new Date();

  let age = today.getFullYear() - year;

  const birthdayHasNotOccurred =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);

  if (birthdayHasNotOccurred) {
    age -= 1;
  }

  if (age < 0) return "";

  return age;
}

function Profile() {
  const { userId } = useParams();
  const { user, token, updateUser } = useAuth();

  const profileUserId = userId ? Number(userId) : Number(user?.id);
  const isOwnProfile = Number(user?.id) === profileUserId;

  const [counts, setCounts] = useState({
    followersCount: 0,
    followingCount: 0,
  });

  const [followListType, setFollowListType] = useState(null);
  const [followUsers, setFollowUsers] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState("");

  const [profile, setProfile] = useState({
    username: "",
    country: "",
    gender: "",
    birthday: "",
    profileImageUrl: "",
  });

  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    if (!profileUserId || !token) return;

    async function loadCounts() {
      try {
        const data = await getFollowCounts(profileUserId);

        setCounts({
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
        });
      } catch (err) {
        console.error("Unable to load follow counts", err);
      }
    }

    async function loadProfile() {
      try {
        const data = isOwnProfile
          ? await getProfile(token)
          : await getUserProfile(token, profileUserId);

        setProfile({
          username: data.username || "",
          country: data.country || "",
          gender: data.gender || "",
          birthday: normalizeBirthday(data.birthday),
          profileImageUrl:
            data.profileImageUrl ||
            data.profile_image ||
            "",
        });
      } catch (err) {
        console.error("Unable to load profile", err);
      }
    }

    async function loadRecipes() {
      try {
        setRecipesLoading(true);
        setRecipesError("");

        const data = await fetchRecipes(token, "date", "desc");

        const allRecipes = Array.isArray(data)
          ? data
          : Array.isArray(data.recipes)
            ? data.recipes
            : [];

        const userRecipes = allRecipes.filter((recipe) => {
          const creatorId =
            recipe.creatorId ??
            recipe.creator_id ??
            recipe.userId ??
            recipe.idUsers;

          return Number(creatorId) === profileUserId;
        });

        setRecipes(userRecipes);
      } catch (err) {
        console.error("Unable to load profile recipes", err);
        setRecipesError(err.message);
      } finally {
        setRecipesLoading(false);
      }
    }

    setFollowListType(null);
    setFollowUsers([]);
    setFollowListError("");

    loadCounts();
    loadProfile();
    loadRecipes();
  }, [profileUserId, isOwnProfile, token]);

  function getProfileImageSrc(url) {
    if (!url || typeof url !== "string") return "";

    if (
      url.startsWith("http") ||
      url.startsWith("data:") ||
      url.startsWith("blob:")
    ) {
      return url;
    }

    return `${API_BASE}${url}`;
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((previousProfile) => ({
      ...previousProfile,
      [name]: value,
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
  }

  async function handleSave() {
    try {
      setSaving(true);

      const profilePayload = {
        ...profile,
        age: calculateAge(profile.birthday),
      };

      const updatedProfile = await updateProfile(token, profilePayload);

      let profileImageUrl =
        updatedProfile.profileImageUrl ??
        updatedProfile.profile_image ??
        profile.profileImageUrl;

      if (imageFile) {
        const imageResult = await uploadProfileImage(token, imageFile);

        profileImageUrl =
          imageResult.profileImageUrl ??
          imageResult.profile_image ??
          profileImageUrl;

        if (profileImageUrl) {
          const separator = profileImageUrl.includes("?") ? "&" : "?";
          profileImageUrl = `${profileImageUrl}${separator}t=${Date.now()}`;
        }

        setImageFile(null);
      }

      const savedBirthday = normalizeBirthday(
        updatedProfile.birthday ?? profile.birthday
      );

      const savedUsername =
        updatedProfile.username ?? profile.username;

      setProfile({
        username: savedUsername,
        country: updatedProfile.country ?? profile.country,
        gender: updatedProfile.gender ?? profile.gender,
        birthday: savedBirthday,
        profileImageUrl: profileImageUrl || "",
      });

      updateUser({
        id: user.id,
        username: savedUsername,
      });

      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRecipeSaveToggle(recipeId, isSaved) {
    try {
      if (isSaved) {
        await unsaveRecipe(recipeId, token);
      } else {
        await saveRecipe(recipeId, token);
      }

      setRecipes((currentRecipes) =>
        currentRecipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                isSaved: !isSaved,
              }
            : recipe
        )
      );
    } catch (err) {
      alert(err.message);
    }
  }

  async function openFollowList(type) {
    if (followListType === type) {
      closeFollowList();
      return;
    }

    try {
      setFollowListType(type);
      setFollowUsers([]);
      setFollowListError("");
      setFollowListLoading(true);

      const data =
        type === "followers"
          ? await getFollowers(profileUserId)
          : await getFollowing(profileUserId);

      const users =
        type === "followers"
          ? data.followers || []
          : data.following || [];

      setFollowUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      setFollowListError(err.message);
    } finally {
      setFollowListLoading(false);
    }
  }

  function closeFollowList() {
    setFollowListType(null);
    setFollowUsers([]);
    setFollowListError("");
  }

  if (!profileUserId) {
    return <main className="profile-page">Loading profile...</main>;
  }

  const calculatedAge = calculateAge(profile.birthday);

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div
          className={`profile-avatar${
            profile.profileImageUrl ? "" : " profile-avatar-empty"
          }`}
        >
          {profile.profileImageUrl ? (
            <img
              src={getProfileImageSrc(profile.profileImageUrl)}
              alt={`${profile.username || "User"} profile`}
            />
          ) : (
            <span>No profile picture</span>
          )}
        </div>

        <h1>
          {editing ? (
            <input
              name="username"
              value={profile.username}
              onChange={handleChange}
            />
          ) : (
            profile.username || `User #${profileUserId}`
          )}
        </h1>

        <p>{isOwnProfile ? "My Profile" : "Creator Profile"}</p>

        <div className="profile-stats">
          <button
            type="button"
            className="profile-stat-button"
            onClick={() => openFollowList("followers")}
          >
            <strong>{counts.followersCount}</strong> followers
          </button>

          <button
            type="button"
            className="profile-stat-button"
            onClick={() => openFollowList("following")}
          >
            <strong>{counts.followingCount}</strong> following
          </button>
        </div>

        {followListType && (
          <section className="follow-inline-panel">
            <div className="follow-inline-header">
              <h2>
                {followListType === "followers"
                  ? "Followers"
                  : "Following"}
              </h2>

              <button
                type="button"
                className="follow-inline-close"
                onClick={closeFollowList}
                aria-label="Close follow list"
              >
                ×
              </button>
            </div>

            {followListLoading && <p>Loading...</p>}

            {followListError && (
              <p className="error-message">{followListError}</p>
            )}

            {!followListLoading &&
              !followListError &&
              followUsers.length === 0 && (
                <p>
                  No{" "}
                  {followListType === "followers"
                    ? "followers"
                    : "followed users"}{" "}
                  yet.
                </p>
              )}

            <div className="follow-user-list">
              {followUsers.map((listedUser) => {
                const listedUserId =
                  listedUser.idUsers ??
                  listedUser.id ??
                  listedUser.userId;

                if (!listedUserId) return null;

                const username =
                  listedUser.username || `User #${listedUserId}`;

                const imageUrl =
                  listedUser.profileImageUrl ??
                  listedUser.profile_image ??
                  listedUser.profileImage ??
                  "";

                const imageSrc = getProfileImageSrc(imageUrl);

                return (
                  <Link
                    key={listedUserId}
                    className="follow-user-row"
                    to={`/profile/${listedUserId}`}
                    onClick={closeFollowList}
                  >
                    <span
                      className={`follow-user-avatar${
                        imageSrc ? "" : " follow-user-avatar-empty"
                      }`}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={`${username} profile`}
                        />
                      ) : (
                        "No photo"
                      )}
                    </span>

                    <strong>{username}</strong>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {isOwnProfile && editing && (
          <p>
            <strong>Profile picture:</strong>{" "}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleImageChange}
            />
          </p>
        )}

        <p>
          <strong>Country:</strong>{" "}
          {editing ? (
            <input
              name="country"
              value={profile.country}
              onChange={handleChange}
            />
          ) : (
            profile.country || "-"
          )}
        </p>

        <p>
          <strong>Gender:</strong>{" "}
          {editing ? (
            <select
              name="gender"
              value={profile.gender}
              onChange={handleChange}
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          ) : (
            profile.gender || "-"
          )}
        </p>

        <p>
          <strong>Birthday:</strong>{" "}
          {editing ? (
            <input
              type="date"
              name="birthday"
              value={profile.birthday}
              onChange={handleChange}
              max={new Date().toISOString().slice(0, 10)}
            />
          ) : (
            profile.birthday || "-"
          )}
        </p>

        <p>
          <strong>Age:</strong> {calculatedAge === "" ? "-" : calculatedAge}
        </p>

        {isOwnProfile &&
          (editing ? (
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)}>
              Edit Profile
            </button>
          ))}

        {!isOwnProfile && <FollowButton userId={profileUserId} />}
      </section>

      <section className="profile-recipes-section">
        <div className="profile-recipes-header">
          <h2>
            {isOwnProfile
              ? "My Recipes"
              : `${profile.username || "User"}'s Recipes`}
          </h2>

          {!recipesLoading && (
            <span>
              {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
            </span>
          )}
        </div>

        {recipesLoading && (
          <div className="feed-status">Loading recipes...</div>
        )}

        {recipesError && (
          <div className="feed-status error-message">
            {recipesError}
          </div>
        )}

        {!recipesLoading &&
          !recipesError &&
          recipes.length === 0 && (
            <div className="empty-feed">
              This user has not posted any recipes yet.
            </div>
          )}

        {!recipesLoading && !recipesError && recipes.length > 0 && (
          <div className="feed-list">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onSaveToggle={handleRecipeSaveToggle}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Profile;