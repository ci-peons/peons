export function Card({ onOpen, title }: { onOpen: () => void; title: string }) {
  return (
    <div className="card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}>
      {title}
    </div>
  );
}
