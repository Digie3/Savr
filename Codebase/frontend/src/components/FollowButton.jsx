import { useState } from "react";
import { followUser, unfollowUser } from "../lib/followService";

function FollowButton({ userId, initiallyFollowing = false }) {
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);

  async function handleClick() {
    const data = isFollowing
      ? await unfollowUser(userId)
      : await followUser(userId);

    if (data.error) {
      alert(data.error);
      return;
    }

    setIsFollowing(!isFollowing);
  }

  return (
    <button onClick={handleClick} className="follow-btn">
      {isFollowing ? "Unfollow" : "Follow"}
    </button>
  );
}

export default FollowButton;