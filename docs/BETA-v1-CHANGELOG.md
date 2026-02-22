# LoopVault Web — Beta v1 Changelog

Date: 2026-02-22

## Highlights
- Stabilized calibration workflow behavior and out-of-tolerance handling.
- Hardened Settings and preference handling to eliminate runtime crashes.
- Improved document output fidelity for signatures and calibration verification.
- Added cloud-sync quality-of-life visibility and validation affordances.

## Reliability and Build
- Fixed production build path to generate deployable dist output.
- Added ESLint-based linting workflow and CI validation gates.
- Verified lint, typecheck, and production build health.

## Calibration Workflow
- Added DP square-root-aware expected mA logic when extraction is set to In Transmitter.
- Added inline expected mode indicator (linear vs square-root), with visual badge styling.
- Added configurable reading tolerance (default ±2% of 16 mA span) with selectable alternatives.
- Added out-of-tolerance detection based on selected tolerance.
- Added % deviation column between As-Found and As-Left as % of span.
- Added red row highlighting for tolerance breaches.
- Fixed calibration disposition panel disappearing while typing.
- Fixed false missing-expected warnings by persisting auto-populated applied inputs.

## Loop Check and Sign-off
- Fixed metadata input flakiness (typing/backspace) by using draft state and blur commit where needed.
- Fixed metadata dropdown selections not persisting under concurrent updates.
- Updated signature/completion flow so users can sign before or after completion.
- Fixed signature canvas overlap/stacking by clearing after successful save.

## PDF Export
- Fixed overlapping layout issues in generic PDF sections.
- Added calibration tolerance summary to generated PDFs.
- Added out-of-tolerance point count summary for quick reviewer visibility.
- Added per-row tolerance status text in calibration PDF table (Within Tol / Out of Tol).
- Preserved verification chain output (completion hash, signature hash, snapshot hash, mutation flag).

## Settings and Preferences
- Fixed Role & Access crashes caused by malformed runtime preference values.
- Isolated selected role state to prevent preference-shape mutation crashes.
- Fixed SyntheticEvent null-target crashes (capturing checked/value before state updates).
- Celebration settings now propagate live across active screens without reload.

## Celebration and Easter Egg UX
- Added celebration mode persistence and immediate runtime effect.
- Upgraded celebration audio to randomized synthetic jingle patterns.
- Added hidden easter-egg triggers and toast feedback in layout interactions.

## Cloud Sync MVP
- Added connection test feedback and last successful sync visibility.
- Added chunked blob sync support for signatures, evidence, and documents.

## Notes
- Beta v1 focuses on field usability, crash resistance, and auditable calibration output.
- Production hardening for auth/RLS and larger-scale sync conflict handling remains a post-beta step.
