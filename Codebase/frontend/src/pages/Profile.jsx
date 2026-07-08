import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import FollowButton from "../components/FollowButton";
import { useAuth } from "../auth/useAuth";
import { getFollowCounts } from "../lib/followService";
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
      const data = await getFollowCounts(profileUserId);

      setCounts({
        followersCount: data.followersCount || 0,
        followingCount: data.followingCount || 0,
      });
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
        console.error(err);
      }
    }

    loadCounts();
    loadProfile();
  }, [profileUserId, isOwnProfile, token]);

  function getProfileImageSrc(url) {
    if (!url) return "";

    if (
      url.startsWith("http") ||
      url.startsWith("data:") ||
      url.startsWith("blob:")
    ) {
      return url;
    }

    return `${API_BASE}${url}`;
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
  }

  async function handleSave() {
    try {
      setSaving(true);

      let updated = await updateProfile(token, profile);

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
          ? imageFile
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
          <span>{counts.followersCount} followers</span>
          <span>{counts.followingCount} following</span>
        </div>

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
            <button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          ) : (
            <button onClick={() => setEditing(true)}>Edit Profile</button>
          ))}

        {!isOwnProfile && <FollowButton userId={profileUserId} />}
      </section>
    </main>
  );
}

export default Profile;