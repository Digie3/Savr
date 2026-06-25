import { useEffect, useRef } from "react";

import { trackActivity } from "../lib/activity";

function Home() {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    trackActivity({
      eventType: "page_view",
      entityType: "page",
      entityId: "home",
      metadata: { path: "/home" },
    });
  }, []);

  return (
    <div>
      <h1>Discover Recipes</h1>
      
    </div>
  );
}

export default Home;
