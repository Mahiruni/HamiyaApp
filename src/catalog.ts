import type { Product } from './types';
import { foodMinimum, purchasable } from './quantity.ts';
import { variantLabel } from './storefront.ts';

export function foodAvailability(product: Product) {
  if (product.category !== 'food' || !['available', 'low_stock'].includes(product.status))
    return product.status;
  const available = product.stock - product.reserved;
  return available <= 0 ? 'out_of_stock' : available < foodMinimum ? 'low_stock' : 'available';
}

export function matchesProduct(product: Product, search: string, t: (key: string) => string) {
  const query = search.trim().normalize('NFKC').toLocaleLowerCase();
  const names = Object.values(product.translations).map((copy) => copy?.name || '');
  return [product.name, ...names, product.variant, variantLabel(product.variant, t)]
    .join(' ')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .includes(query);
}

export function availableForCustomer(product: Product) {
  return product.category === 'food'
    ? purchasable(product)
    : ['available', 'low_stock'].includes(product.status);
}
