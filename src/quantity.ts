import type { Product } from './types';

export const foodMinimum = 20;
export const foodMaximum = 10000;
export function validFoodQuantity(value: string, available: number) {
  return (
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) >= foodMinimum &&
    Number(value) <= Math.min(available, foodMaximum)
  );
}
export function stepFoodQuantity(value: string, change: number, available: number) {
  const maximum = Math.min(available, foodMaximum);
  if (maximum < foodMinimum) return foodMinimum;
  const current =
    /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : foodMinimum;
  return Math.max(foodMinimum, Math.min(maximum, current + change));
}
export function purchasable(product: Product): product is Product & { price_cents: number } {
  return (
    product.category === 'food' &&
    product.published &&
    product.confirmed &&
    Number.isSafeInteger(product.price_cents) &&
    Number(product.price_cents) > 0 &&
    product.sales_unit === 'carton' &&
    product.available_quantity >= foodMinimum &&
    ['available', 'low_stock'].includes(product.status)
  );
}
