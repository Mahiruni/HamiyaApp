export type SheetSnap = 45 | 60 | 75;
export function usableSheetHeight(viewport: number, safeTop: number, bottom: number) {
  return Math.max(0, viewport - Math.max(0, safeTop) - Math.max(0, bottom) - 12);
}
export function nearestSheetSnap(height: number, usable: number): SheetSnap {
  const percent = usable > 0 ? (height / usable) * 100 : 45;
  return ([45, 60, 75] as const).reduce(
    (best, snap) => (Math.abs(snap - percent) < Math.abs(best - percent) ? snap : best),
    45 as SheetSnap,
  );
}

// Fixed elements use layout-viewport coordinates. The keyboard may shrink only
// the visual viewport, and focusing a field can also pan its top edge.
export function sheetViewportGeometry({
  layoutHeight,
  visualHeight,
  visualTop = 0,
  safeTop = 0,
  safeBottom = 0,
  dockTop,
}: {
  layoutHeight: number;
  visualHeight: number;
  visualTop?: number;
  safeTop?: number;
  safeBottom?: number;
  dockTop?: number;
}) {
  const top = Math.max(0, safeTop, visualTop);
  const visibleBottom = Math.max(
    top,
    Math.min(layoutHeight - Math.max(0, safeBottom), visualTop + visualHeight),
  );
  const contentBottom = Math.max(top, Math.min(visibleBottom, dockTop ?? visibleBottom) - 12);
  const bottom = Math.max(0, layoutHeight - contentBottom);
  return { top, bottom, usable: usableSheetHeight(layoutHeight, top, bottom) };
}
