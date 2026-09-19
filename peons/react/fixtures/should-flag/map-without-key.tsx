export function List({ items }: { items: { id: string; name: string }[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li>{item.name}</li>
      ))}
    </ul>
  );
}
