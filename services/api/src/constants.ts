export const ENGINE_VERSION = 'v1.0.0';

const coerceNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const ANALYZE_DAILY_CAP = coerceNumber(process.env.ANALYZE_DAILY_CAP, 10);
export const SCRIPT_DAILY_CAP = coerceNumber(process.env.SCRIPT_DAILY_CAP, 10);
export const EXPORT_DAILY_CAP = coerceNumber(process.env.EXPORT_DAILY_CAP, 10);

export const CSP_POLICY =
  "default-src 'none'; connect-src 'self'; img-src 'self'; font-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'";
