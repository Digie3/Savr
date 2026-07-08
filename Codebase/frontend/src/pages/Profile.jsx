import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import FollowButton from "../components/FollowButton";
import { useAuth } from "../auth/useAuth";
import { getFollowCounts } from "../lib/followService";

function Profile() {
  const { userId } = useParams();
  const { user } = useAuth();

  const profileUserId = userId ? Number(userId) : user?.id;
  const isOwnProfile = user?.id === profileUserId;
  const profileName = isOwnProfile ? user?.username : `User #${profileUserId}`;


  const [counts, setCounts] = useState({
    followersCount: 0,
    followingCount: 0,
  });

  useEffect(() => {
    if (!profileUserId) return;

    async function loadCounts() {
      const data = await getFollowCounts(profileUserId);
      setCounts({
        followersCount: data.followersCount || 0,
        followingCount: data.followingCount || 0,
      });
    }

    loadCounts();
  }, [profileUserId]);

  if (!profileUserId) {
    return <main className="page">Loading profile...</main>;
  }

  return (
    <main className="page">
      <section className="profile-card">
<h1>{profileName}</h1>
<p>{isOwnProfile ? "My Profile" : "Creator Profile"}</p>
        <div className="profile-stats">
          <span>{counts.followersCount} followers</span>
          <span>{counts.followingCount} following</span>
        </div>

        {!isOwnProfile && <FollowButton userId={profileUserId} />}
      </section>
    </main>
  );
}

export default Profile;