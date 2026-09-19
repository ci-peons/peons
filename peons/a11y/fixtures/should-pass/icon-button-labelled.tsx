import { XIcon } from "./icons";
export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} aria-label="Close dialog">
      <XIcon aria-hidden="true" />
    </button>
  );
}
