import { RISK_LEVEL_CONFIG, UNSCORED_STYLE } from '../constants/enums';

// "Patient 8222157" -> "P8"; used for the avatar squares.
export function initialsFor(name) {
  if (!name) return 'PT';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

// "[70-80)" -> "70-79 yrs"
export function formatAgeGroup(band) {
  if (!band) return '—';
  const m = /^\[(\d+)-(\d+)\)$/.exec(band);
  return m ? `${m[1]}-${Number(m[2]) - 1} yrs` : band;
}

// Score is a whole percent from the API, or null when the patient has not been scored.
export function formatRisk(score) {
  return score === null || score === undefined ? '—' : `${score}%`;
}

export function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${value}%`;
}

export function riskStyle(level) {
  return RISK_LEVEL_CONFIG[level] ? { ...RISK_LEVEL_CONFIG[level] } : { ...UNSCORED_STYLE };
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function displayValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;
}
