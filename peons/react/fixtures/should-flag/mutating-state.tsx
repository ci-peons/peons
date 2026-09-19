import { useState } from "react";
export function Todos() {
  const [todos, setTodos] = useState<string[]>([]);
  function add(t: string) {
    todos.push(t);
    setTodos(todos);
  }
  return <button onClick={() => add("x")}>{todos.length}</button>;
}
