import { useEffect, useState } from "react";
export function Clock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setInterval(() => setNow(Date.now()), 1000);
  }, []);
  return <time>{new Date(now).toLocaleTimeString()}</time>;
}
