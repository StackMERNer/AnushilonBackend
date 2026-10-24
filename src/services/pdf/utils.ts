/**
 * Convert English digits to Bengali digits.
 */
export function toBengaliNumber(value: number | string): string {
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

  return String(value).replace(/\d/g, (digit) => bengaliDigits[Number(digit)]);
}
