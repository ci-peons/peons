import { useState } from "react";
export function Toggle({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  const [on, setOn] = useState(false);
  return <button onClick={() => setOn(!on)}>{on ? "On" : "Off"}</button>;
}
