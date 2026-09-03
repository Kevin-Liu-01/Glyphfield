'use client';

import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const HOVER_OPEN_DELAY_MS = 420;
const HOVER_CLOSE_DELAY_MS = 110;
const TOOLTIP_GAP = 10;
const VIEWPORT_MARGIN = 10;
let tooltipWarmUntil = 0;

type PreviewTriggerProps = {
  'aria-describedby'?: string;
  'data-studio-preview-trigger'?: string;
  onBlurCapture?: FocusEventHandler<HTMLElement>;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
  onKeyDownCapture?: KeyboardEventHandler<HTMLElement>;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
};

type StudioPreviewTooltipProps = {
  children: ReactElement<PreviewTriggerProps>;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  preview?: ReactNode;
  size?: 'compact' | 'default';
  title: ReactNode;
};

type TooltipLayout = {
  left: number;
  originX: number;
  side: 'bottom' | 'top';
  top: number;
};

function nextTooltipLayout(anchor: HTMLElement, tooltip: HTMLElement): TooltipLayout {
  const anchorBounds = anchor.getBoundingClientRect();
  const tooltipBounds = tooltip.getBoundingClientRect();
  const maximumLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - tooltipBounds.width - VIEWPORT_MARGIN);
  const left = Math.min(
    maximumLeft,
    Math.max(VIEWPORT_MARGIN, anchorBounds.left + anchorBounds.width / 2 - tooltipBounds.width / 2)
  );
  const canOpenAbove = anchorBounds.top >= tooltipBounds.height + TOOLTIP_GAP + VIEWPORT_MARGIN;
  const proposedTop = canOpenAbove
    ? anchorBounds.top - tooltipBounds.height - TOOLTIP_GAP
    : anchorBounds.bottom + TOOLTIP_GAP;
  const top = Math.min(
    Math.max(VIEWPORT_MARGIN, proposedTop),
    Math.max(VIEWPORT_MARGIN, window.innerHeight - tooltipBounds.height - VIEWPORT_MARGIN)
  );
  return {
    left,
    originX: Math.min(tooltipBounds.width - 18, Math.max(18, anchorBounds.left + anchorBounds.width / 2 - left)),
    side: canOpenAbove ? 'top' : 'bottom',
    top,
  };
}

export default function StudioPreviewTooltip({
  children,
  description,
  eyebrow,
  meta,
  preview,
  size = 'default',
  title,
}: StudioPreviewTooltipProps) {
  const tooltipId = useId();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef(0);
  const closeTimerRef = useRef(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [keyboardOpened, setKeyboardOpened] = useState(false);
  const [layout, setLayout] = useState<TooltipLayout | null>(null);
  const [open, setOpen] = useState(false);
  const triggerProps = children.props;

  function clearTimers() {
    window.clearTimeout(openTimerRef.current);
    window.clearTimeout(closeTimerRef.current);
  }

  function show(nextAnchor: HTMLElement, keyboard: boolean) {
    clearTimers();
    const reveal = () => {
      tooltipWarmUntil = Date.now() + 900;
      setAnchor(nextAnchor);
      setKeyboardOpened(keyboard);
      setLayout(null);
      setOpen(true);
    };
    if (keyboard || open || Date.now() < tooltipWarmUntil) {
      reveal();
      return;
    }
    openTimerRef.current = window.setTimeout(reveal, HOVER_OPEN_DELAY_MS);
  }

  function hideSoon() {
    window.clearTimeout(openTimerRef.current);
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!open || !anchor || !tooltip) return;
    setLayout(nextTooltipLayout(anchor, tooltip));
  }, [anchor, open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    window.clearTimeout(openTimerRef.current);
    window.clearTimeout(closeTimerRef.current);
  }, []);

  const describedBy = [triggerProps['aria-describedby'], open ? tooltipId : null]
    .filter(Boolean)
    .join(' ') || undefined;
  const trigger = cloneElement(children, {
    'aria-describedby': describedBy,
    'data-studio-preview-trigger': 'true',
    onBlurCapture: (event) => {
      triggerProps.onBlurCapture?.(event);
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
      hideSoon();
    },
    onFocusCapture: (event) => {
      triggerProps.onFocusCapture?.(event);
      if (!event.defaultPrevented) show(event.currentTarget, true);
    },
    onKeyDownCapture: (event) => {
      triggerProps.onKeyDownCapture?.(event);
      if (event.key === 'Escape') {
        window.clearTimeout(openTimerRef.current);
        setOpen(false);
      }
    },
    onPointerEnter: (event) => {
      triggerProps.onPointerEnter?.(event);
      if (!event.defaultPrevented && event.pointerType !== 'touch') show(event.currentTarget, false);
    },
    onPointerLeave: (event) => {
      triggerProps.onPointerLeave?.(event);
      hideSoon();
    },
  });

  return (
    <>
      {trigger}
      {open && typeof document !== 'undefined' ? createPortal(
        <div
          className='studio-preview-tooltip'
          data-keyboard={keyboardOpened ? 'true' : 'false'}
          data-positioned={layout ? 'true' : 'false'}
          data-size={size}
          data-side={layout?.side ?? 'top'}
          id={tooltipId}
          onPointerEnter={() => window.clearTimeout(closeTimerRef.current)}
          onPointerLeave={hideSoon}
          ref={tooltipRef}
          role='tooltip'
          style={{
            '--studio-preview-origin-x': `${layout?.originX ?? 24}px`,
            left: layout?.left ?? 0,
            top: layout?.top ?? 0,
          } as CSSProperties}
        >
          {preview ? <div className='studio-preview-tooltip__visual'>{preview}</div> : null}
          <div className='studio-preview-tooltip__copy'>
            {eyebrow ? <span>{eyebrow}</span> : null}
            <strong>{title}</strong>
            {description ? <p>{description}</p> : null}
            {meta ? <small>{meta}</small> : null}
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
