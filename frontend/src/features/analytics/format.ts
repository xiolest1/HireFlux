export function percent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

export function percentagePointDelta(value: number) {
  const points = Math.round(value * 100);
  return `${points > 0 ? "+" : ""}${points} pp`;
}
