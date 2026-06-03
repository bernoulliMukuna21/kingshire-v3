export function formatMilestoneCount(count: number) {
  if (count < 10) return String(count);
  if (count < 100) return `${Math.floor(count / 10) * 10}+`;
  if (count < 1000) return `${Math.floor(count / 100) * 100}+`;

  const thousands = Math.floor(count / 100) / 10;
  const formatted =
    Number.isInteger(thousands) || thousands >= 10
      ? Math.floor(thousands).toString()
      : thousands.toFixed(1);

  return `${formatted}k+`;
}
