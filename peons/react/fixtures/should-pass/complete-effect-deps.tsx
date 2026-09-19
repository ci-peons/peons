import { useEffect, useState } from "react";
export function Profile({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/users/${userId}`, { signal: ctrl.signal }).then((r) => r.json()).then((u) => setName(u.name)).catch(() => {});
    return () => ctrl.abort();
  }, [userId]);
  return <p>{name}</p>;
}
