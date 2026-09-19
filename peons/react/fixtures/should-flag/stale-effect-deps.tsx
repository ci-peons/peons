import { useEffect } from "react";
export function Title({ userId }: { userId: string }) {
  useEffect(() => {
    document.title = `User ${userId}`;
  }, []);
  return <h1>Profile</h1>;
}
