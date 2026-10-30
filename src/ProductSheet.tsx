import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlay } from './experience';
import { nearestSheetSnap, sheetViewportGeometry, type SheetSnap } from './sheet-geometry';
import { useApp } from './state';
import './product-sheet.css';

function measureGeometry() {
  const dock = document.querySelector<HTMLElement>('.mobile-nav');
  const viewport = window.visualViewport;
  const top =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  const safeBottom =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0;
  const dockVisible = dock && getComputedStyle(dock).display !== 'none';
  return sheetViewportGeometry({
    layoutHeight: window.innerHeight,
    visualHeight: viewport?.height || window.innerHeight,
    visualTop: viewport?.offsetTop || 0,
    safeTop: top,
    safeBottom,
    dockTop: dockVisible ? dock.getBoundingClientRect().top : undefined,
  });
}

// A non-modal region: the customer dock remains interactive and in the tab order.
export function ProductSheet({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useApp();
  const id = useId();
  const sheet = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const [snap, setSnap] = useState<SheetSnap>(60);
  const [geometry, setGeometry] = useState(measureGeometry);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useOverlay(true, () => close.current());

  useEffect(() => {
    const dock = document.querySelector<HTMLElement>('.mobile-nav');
    const measure = () => setGeometry(measureGeometry());
    const observer = new ResizeObserver(measure);
    const insets = new MutationObserver(measure);
    insets.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    if (dock) observer.observe(dock);
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    document.addEventListener('focusin', measure);
    document.addEventListener('focusout', measure);
    return () => {
      observer.disconnect();
      insets.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
      document.removeEventListener('focusin', measure);
      document.removeEventListener('focusout', measure);
    };
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = Array.from(document.querySelectorAll<HTMLElement>('.app-body, .sidebar'));
    const inert = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    handle.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        close.current();
      }
    };
    const navigate = () => close.current();
    document.addEventListener('keydown', escape);
    window.addEventListener('hamiya:navigate', navigate);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => {
        element.inert = inert[index];
      });
      document.removeEventListener('keydown', escape);
      window.removeEventListener('hamiya:navigate', navigate);
      if (previous?.isConnected && !previous.closest('[inert]'))
        previous.focus({ preventScroll: true });
    };
  }, []);
  const height = dragHeight ?? (geometry.usable * snap) / 100;
  const style = {
    '--sheet-top': `${geometry.top}px`,
    '--sheet-bottom': `${geometry.bottom}px`,
    '--sheet-height': `${height}px`,
  } as CSSProperties;
  return createPortal(
    <>
      <button
        className="product-sheet-backdrop"
        style={style}
        tabIndex={-1}
        aria-label={t('close')}
        onClick={onClose}
      />
      <section
        ref={sheet}
        role="dialog"
        aria-modal="false"
        aria-labelledby={id}
        className={'product-sheet' + (dragHeight !== null ? ' is-dragging' : '')}
        style={style}
      >
        <div className="product-sheet-head">
          <button
            ref={handle}
            className="product-sheet-grip"
            role="slider"
            aria-label={t('sheetSize')}
            aria-valuemin={45}
            aria-valuemax={75}
            aria-valuenow={snap}
            aria-valuetext={t(
              snap === 45 ? 'sheetCompact' : snap === 75 ? 'sheetExpanded' : 'sheetStandard',
            )}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              setSnap((value) => (value === 75 ? 45 : value === 45 ? 60 : 75));
            }}
            onKeyDown={(event) => {
              const next =
                event.key === 'Home'
                  ? 45
                  : event.key === 'End'
                    ? 75
                    : event.key === 'ArrowUp' || event.key === 'ArrowRight'
                      ? Math.min(75, snap + 15)
                      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
                        ? Math.max(45, snap - 15)
                        : null;
              if (next !== null) {
                event.preventDefault();
                setSnap(next as SheetSnap);
              }
            }}
            onPointerDown={(event) => {
              suppressClick.current = false;
              drag.current = {
                y: event.clientY,
                height: sheet.current?.getBoundingClientRect().height || height,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const next = drag.current.height + drag.current.y - event.clientY;
              setDragHeight(
                Math.max(geometry.usable * 0.45, Math.min(geometry.usable * 0.75, next)),
              );
            }}
            onPointerUp={(event) => {
              if (!drag.current) return;
              const movement = drag.current.y - event.clientY;
              const releasedHeight = Math.max(
                geometry.usable * 0.45,
                Math.min(geometry.usable * 0.75, drag.current.height + movement),
              );
              const target = nearestSheetSnap(releasedHeight, geometry.usable);
              drag.current = null;
              setDragHeight(null);
              setSnap(target);
              // A drag must not also trigger the grip's click-to-expand action.
              suppressClick.current = Math.abs(movement) > 6;
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragHeight(null);
            }}
          >
            <span aria-hidden="true" />
          </button>
          <h2 id={id}>{title}</h2>
          <button className="icon-button" aria-label={t('close')} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="product-sheet-scroll">{children}</div>
        {footer && <div className="product-sheet-footer">{footer}</div>}
      </section>
    </>,
    document.body,
  );
}
