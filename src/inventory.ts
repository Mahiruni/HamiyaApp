export function validStockTarget(value: string, reserved: number) {
  const amount = Number(value);
  return (
    /^\d+$/.test(value) &&
    Number.isSafeInteger(amount) &&
    amount <= 10_000_000 &&
    amount >= reserved
  );
}
