export function Card({ onOpen, title }: { onOpen: () => void; title: string }) {
  return (
    <div className="card" onClick={onOpen}>
      {title}
    </div>
  );
}
