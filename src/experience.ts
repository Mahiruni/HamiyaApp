import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { registerOverlay } from './overlay-history';

export function useCompactLayout() {
  const [compact, setCompact] = useState(
    () => Capacitor.isNativePlatform() || matchMedia('(max-width: 1023px)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(max-width: 1023px)');
    const update = () => setCompact(Capacitor.isNativePlatform() || query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}

// A same-URL history entry lets Android Back and browser Back dismiss an overlay first.
// Register after the effect settles so StrictMode never leaves a duplicate entry.
export function useOverlay(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    queueMicrotask(() => {
      if (active) cleanup = registerOverlay(() => close.current());
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [open]);
}

// Keep fixed controls out of the keyboard's visual viewport on older Android WebViews.
export function useKeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const editable = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      const keyboard =
        !!editable &&
        (window.innerHeight - viewport.height > 150 || viewport.height < screen.height * 0.65);
      document.documentElement.classList.toggle('keyboard-open', keyboard);
      document.documentElement.style.setProperty('--visual-height', `${viewport.height}px`);
      if (editable)
        requestAnimationFrame(() => {
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        });
    };
    viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    update();
    return () => {
      viewport.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--visual-height');
    };
  }, []);
}
