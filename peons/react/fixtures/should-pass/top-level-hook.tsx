import { useState } from "react";
export function Toggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(false);
  if (!enabled) return null;
  return <button onClick={() => setOn(!on)}>{on ? "On" : "Off"}</button>;
}
