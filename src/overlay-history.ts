let sequence = 0;
export const overlayStateKey = 'hamiyaOverlay';

export function registerOverlay(onBack: () => void, host: Window = window) {
  const token = `overlay-${++sequence}`;
  host.history.pushState(
    { ...host.history.state, [overlayStateKey]: token },
    '',
    host.location.href,
  );
  const onPop = () => {
    if (host.history.state?.[overlayStateKey] !== token) onBack();
  };
  host.addEventListener('popstate', onPop);
  return () => {
    host.removeEventListener('popstate', onPop);
    if (host.history.state?.[overlayStateKey] === token) host.history.back();
  };
}

export function navigateHistory(route: string, host: Window = window, replace = false) {
  const hash = '#' + route;
  if (host.location.hash === hash && !host.history.state?.[overlayStateKey]) return;
  // Replacing an open overlay keeps the previous page as the next Back destination.
  if (replace || host.history.state?.[overlayStateKey]) host.history.replaceState(null, '', hash);
  else host.history.pushState(null, '', hash);
}
