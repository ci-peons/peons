import { XIcon } from "./icons";
export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose}>
      <XIcon />
    </button>
  );
}
