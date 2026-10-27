import type { Category } from './types';

export const divisions = ['food', 'coffee', 'vehicles'] as const;
export const divisionArtwork = (category: Category) => `/brand/divisions/${category}.webp`;

export function unitLabel(unit: string, t: (key: string) => string) {
  return ['carton', 'cartons'].includes(unit.trim().toLowerCase()) ? t('cartonUnit') : unit;
}

export function variantLabel(variant: string, t: (key: string) => string) {
  const key = variant.trim().toLowerCase();
  return key === 'hard'
    ? t('variantHard')
    : ['soft', 'softi'].includes(key)
      ? t('variantSoft')
      : variant;
}

export function catalogLocation(route: string): { category: Category | 'all'; search: string } {
  const [path, query = ''] = route.split('?');
  const value = path.split('/')[1];
  return {
    category: divisions.includes(value as Category) ? (value as Category) : 'all',
    search: new URLSearchParams(query).get('q') || '',
  };
}

export function catalogRoute(category: Category | 'all' = 'all', search = '') {
  const query = search.trim();
  const path = 'catalog' + (category === 'all' && !query ? '' : '/' + category);
  return path + (query ? '?' + new URLSearchParams({ q: query }).toString() : '');
}
