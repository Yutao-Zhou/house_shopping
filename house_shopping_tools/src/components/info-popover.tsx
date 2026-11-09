import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { useLanguage } from './language-provider';

const OPEN_EVENT = 'nestwise-info-open';

export function InfoPopover({ label, description }: { label: string; description: string }) {
  const { t } = useLanguage();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const focused = useRef(false);
  const overTrigger = useRef(false);
  const overPanel = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, arrow: 20, side: 'bottom', ready: false });

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const dismiss = useCallback(() => {
    cancelClose();
    pinned.current = false;
    overPanel.current = false;
    setOpen(false);
  }, [cancelClose]);
  const reveal = () => {
    cancelClose();
    document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setOpen(true);
  };
  const closeAfterLeave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!pinned.current && !focused.current && !overTrigger.current && !overPanel.current) setOpen(false);
    }, 160);
  };

  useEffect(() => () => cancelClose(), [cancelClose]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) dismiss();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    const anotherOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) dismiss();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener(OPEN_EVENT, anotherOpened);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener(OPEN_EVENT, anotherOpened);
    };
  }, [open, id, dismiss]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      panel.current.style.width = `${Math.min(310, width - 24)}px`;
      const box = panel.current.getBoundingClientRect();
      const height = window.innerHeight;
      const left = Math.max(12, Math.min(anchor.left + anchor.width / 2 - box.width / 2, width - box.width - 12));
      const above = anchor.bottom + box.height + 8 > height - 12 && anchor.top - box.height - 8 >= 12;
      const top = Math.max(12, Math.min(above ? anchor.top - box.height - 8 : anchor.bottom + 8, height - box.height - 12));
      setPosition({ left, top, side: above ? 'top' : 'bottom', ready: true, arrow: Math.max(14, Math.min(anchor.left + anchor.width / 2 - left, box.width - 14)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, label, description]);

  return <>
    <button
      ref={trigger}
      type="button"
      className="info-trigger"
      aria-label={t('了解{0}', { 0: label })}
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => { overTrigger.current = true; reveal(); }}
      onMouseLeave={() => { overTrigger.current = false; closeAfterLeave(); }}
      onFocus={() => { focused.current = true; reveal(); }}
      onBlur={() => {
        focused.current = false;
        if (!overTrigger.current && !overPanel.current) dismiss();
      }}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        cancelClose();
        if (pinned.current) dismiss();
        else { pinned.current = true; reveal(); }
      }}
    >
      <Info size={14} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div
        ref={panel}
        id={id}
        role="tooltip"
        className="info-popover"
        data-side={position.side}
        style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden', '--arrow-left': `${position.arrow}px` } as CSSProperties}
        onMouseEnter={() => { overPanel.current = true; cancelClose(); }}
        onMouseLeave={() => { overPanel.current = false; closeAfterLeave(); }}
      >
        <strong>{label}</strong>
        <p>{description}</p>
      </div>,
      document.body,
    )}
  </>;
}
