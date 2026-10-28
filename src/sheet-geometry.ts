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
