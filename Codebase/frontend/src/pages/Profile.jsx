import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import FollowButton from "../components/FollowButton";
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
import { API_BASE } from "../api";

function Profile() {
  const { userId } = useParams();
  const { user, token, updateUser } = useAuth();

  const profileUserId = userId ? Number(userId) : user?.id;
  const isOwnProfile = user?.id === profileUserId;

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
    age: "",
    profileImageUrl: "",
  });

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
          birthday: data.birthday || "",
          age: data.age || "",
          profileImageUrl: data.profileImageUrl || "",
        });
      } catch (err) {
        console.error("Unable to load profile", err);
      }
    }

    setFollowListType(null);
    setFollowUsers([]);
    setFollowListError("");

    loadCounts();
    loadProfile();
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

      let updated = await updateProfile(token, profile);
      const uploadedNewImage = Boolean(imageFile);

      if (imageFile) {
        updated = await uploadProfileImage(token, imageFile);
        setImageFile(null);
      }

      setProfile({
        username: updated.username || "",
        country: updated.country || "",
        gender: updated.gender || "",
        birthday: updated.birthday || "",
        age: updated.age || "",
        profileImageUrl: updated.profileImageUrl
          ? uploadedNewImage
            ? `${updated.profileImageUrl}?t=${Date.now()}`
            : updated.profileImageUrl
          : "",
      });

      updateUser({
        id: user.id,
        username: updated.username,
      });

      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
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
    return <main className="page">Loading profile...</main>;
  }

  return (
    <main className="page">
      <section className="profile-card">
        <div className="profile-avatar">
          {profile.profileImageUrl ? (
            <img
              src={getProfileImageSrc(profile.profileImageUrl)}
              alt={`${profile.username || "User"} profile`}
            />
          ) : (
            <span>
              {(profile.username || `User #${profileUserId}`)
                .charAt(0)
                .toUpperCase()}
            </span>
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
                  "";

                const imageSrc = getProfileImageSrc(imageUrl);

                return (
                  <Link
                    key={listedUserId}
                    className="follow-user-row"
                    to={`/profile/${listedUserId}`}
                    onClick={closeFollowList}
                  >
                    <span className="follow-user-avatar">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={`${username} profile`}
                        />
                      ) : (
                        username.charAt(0).toUpperCase()
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
            />
          ) : (
            profile.birthday || "-"
          )}
        </p>

        <p>
          <strong>Age:</strong>{" "}
          {editing ? (
            <input
              type="number"
              name="age"
              value={profile.age}
              onChange={handleChange}
            />
          ) : (
            profile.age || "-"
          )}
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
    </main>
  );
}

export default Profile;