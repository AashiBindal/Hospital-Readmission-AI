/** Formats a 0–1 probability as a percentage string. */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Formats an ISO date string for display. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}
