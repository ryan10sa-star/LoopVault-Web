import { engineeringToMilliamp } from './scaling';

export function parseNumericInput(raw: string): number | undefined {
  const normalized = raw.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function calculateFivePointInputs(lrvInput: string, urvInput: string, decimals = 2): number[] | null {
  const lrv = parseNumericInput(lrvInput);
  const urv = parseNumericInput(urvInput);
  const safeDecimals = Number.isFinite(decimals) ? Math.max(0, Math.min(4, Math.trunc(decimals))) : 2;
  if (typeof lrv !== 'number' || typeof urv !== 'number' || urv === lrv) {
    return null;
  }

  const span = urv - lrv;
  if (!Number.isFinite(span)) {
    return null;
  }
  return [
    lrv,
    lrv + span * 0.25,
    lrv + span * 0.5,
    lrv + span * 0.75,
    urv
  ].map((point) => Number(point.toFixed(safeDecimals)));
}

export function calculateExpectedMilliamp(
  appliedInput: string,
  lrvInput: string,
  urvInput: string,
  transferFunctionInput?: string,
  squareRootInTransmitter?: boolean
): number | undefined {
  const applied = parseNumericInput(appliedInput);
  const lrv = parseNumericInput(lrvInput);
  const urv = parseNumericInput(urvInput);
  if (typeof applied !== 'number' || typeof lrv !== 'number' || typeof urv !== 'number' || urv === lrv) {
    return undefined;
  }
  if (!Number.isFinite(applied) || !Number.isFinite(lrv) || !Number.isFinite(urv)) {
    return undefined;
  }

  const span = urv - lrv;
  if (!Number.isFinite(span) || span === 0) {
    return undefined;
  }

  const transferFunction = (transferFunctionInput ?? '').toLowerCase();
  if (transferFunction.includes('square') || squareRootInTransmitter) {
    const normalized = (applied - lrv) / span;
    const clamped = Math.max(0, Math.min(1, normalized));
    const rooted = Math.sqrt(clamped);
    if (!Number.isFinite(rooted)) {
      return undefined;
    }
    return Number((4 + rooted * 16).toFixed(3));
  }

  const expected = engineeringToMilliamp(applied, lrv, urv);
  return Number.isFinite(expected) ? Number(expected.toFixed(3)) : undefined;
}
