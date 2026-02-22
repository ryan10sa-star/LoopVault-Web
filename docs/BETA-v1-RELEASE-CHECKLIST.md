# LoopVault Web — Beta v1 Release Checklist

Date: 2026-02-22
Owner: __________________

## 1) Pre-Release Validation
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Confirm dist assets and PWA files are generated.

## 2) Critical Flow Smoke Tests
- [ ] Create/import tags and open tag detail.
- [ ] Start loop-check job, complete workflow, save signature, generate loop folder PDF.
- [ ] Verify PDF has clean signature rendering and verification summary.
- [ ] Start calibration job and set DP SQRT extraction to In Transmitter.
- [ ] Confirm expected mA updates for square-root mode.
- [ ] Confirm tolerance selector defaults to ±2% and can be changed.
- [ ] Enter values outside tolerance and verify:
  - [ ] Red row highlight appears.
  - [ ] Workflow exception/out-of-tolerance warning appears.
  - [ ] Generated PDF captures tolerance and out-of-tolerance summary.
- [ ] Confirm As-Found + As-Left deviation (% span) renders correctly.

## 3) Settings Stability
- [ ] Change Role selection (tech/lead/admin) without crash.
- [ ] Toggle Celebration mode and save; verify immediate effect without reload.
- [ ] Confirm no runtime crash in Role & Access or Celebration sections.

## 4) Cloud Sync MVP
- [ ] Open Settings → Cloud Sync and enter project values.
- [ ] Run Test Connection (both tables reachable).
- [ ] Push snapshot from Device A.
- [ ] Pull snapshot from Device B.
- [ ] Verify signatures/evidence/documents are present after pull.
- [ ] Verify last successful sync status updates.

## 5) Operational Handoff
- [ ] Export backup ZIP from Diagnostics.
- [ ] Store backup in agreed repository/location.
- [ ] Share Beta v1 notes and known limits with field users.
- [ ] Confirm rollback strategy (previous build + backup restore).

## 6) Sign-off
- [ ] Product/Operations sign-off
- [ ] Field lead sign-off
- [ ] Technical owner sign-off

Final release decision:  GO / NO-GO
