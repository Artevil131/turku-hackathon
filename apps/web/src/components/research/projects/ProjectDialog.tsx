import { type ReactNode, useEffect, useRef } from "react";

export function ProjectDialog({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="project-dialog"
      aria-labelledby="project-dialog-title"
      onClose={(event) => {
        // StrictMode can reopen the dialog before a cleanup's queued close event arrives.
        if (!event.currentTarget.open) onClose();
      }}
    >
      <header>
        <h2 id="project-dialog-title">{title}</h2>
        <button type="button" onClick={onClose}>
          {closeLabel}
        </button>
      </header>
      {children}
    </dialog>
  );
}
