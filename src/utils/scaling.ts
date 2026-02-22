export function engineeringToMilliamp(value: number, lrv: number, urv: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(lrv) || !Number.isFinite(urv) || urv === lrv) {
    return 4;
  }
  const normalized = (value - lrv) / (urv - lrv);
  const clamped = Math.max(0, Math.min(1, normalized));
  return 4 + clamped * 16;
}
