const vnd = new Intl.NumberFormat("vi-VN");

/** Định dạng số nguyên VND, ví dụ 1500000 -> "1.500.000₫". */
export function formatPrice(value: number): string {
  return `${vnd.format(value)}₫`;
}

/** Định dạng số lượng, ví dụ 12000 -> "12.000". */
export function formatNumber(value: number): string {
  return vnd.format(value);
}
