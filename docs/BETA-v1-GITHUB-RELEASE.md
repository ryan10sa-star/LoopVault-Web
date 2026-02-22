# LoopVault Web Beta v1

LoopVault Web Beta v1 is focused on field reliability, calibration accuracy visibility, and audit-ready output.

## What’s new
- Calibration expected mA now respects DP square-root extraction when set to **In Transmitter**.
- Added calibration tolerance control (default **±2% span**) with selectable alternatives.
- Added out-of-tolerance row highlighting and workflow exception signaling.
- Added `% Dev (AF→AL)` as **% of span** in calibration grid.
- PDF export now includes tolerance summary, per-row tolerance status, and out-of-tolerance point count.
- Signature and generic PDF layout/signature rendering issues fixed.
- Settings stability improvements (role/celebration crash fixes and live preference propagation).
- Celebration mode now applies immediately; randomized celebration audio patterns added.
- Cloud sync UX improvements (connection test clarity and last successful sync visibility).

## Quality gates
- Lint: ✅
- Typecheck: ✅
- Production build: ✅

## Notes
- This beta emphasizes usability and traceability for field turnover workflows.
- Post-beta hardening remains for production auth/RLS tightening and broader sync conflict policy.
