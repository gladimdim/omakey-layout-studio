import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog: focus moves into it and stays there (Tab wraps), Escape
 * or a click on the backdrop closes it, and focus goes back where it was.
 */
export function Modal({ title, onClose, children, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  // Read during the first render, before an autoFocus child takes focus.
  const [before] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const el = box.current;
    if (el && !el.contains(document.activeElement)) {
      (el.querySelector<HTMLElement>("[autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    }
    return () => {
      if (before && before.isConnected) before.focus();
    };
  }, [before]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close.current();
      return;
    }
    if (e.key !== "Tab" || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === box.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && close.current()}>
      <div ref={box} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <h3 id={titleId}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
