export function Total({ items }: { items: { price: number }[] }) {
  const total = items.reduce((s, i) => s + i.price, 0);
  return <span>{total}</span>;
}
