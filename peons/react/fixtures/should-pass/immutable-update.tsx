import { useState } from "react";
export function Todos() {
  const [todos, setTodos] = useState<string[]>([]);
  return <button onClick={() => setTodos((prev) => [...prev, "x"])}>{todos.length}</button>;
}
