# RoadCopilot implementation tasks

Ordered for **dependency clarity** and **parallel ownership**. Agents should implement only inside their area unless explicitly asked to integrate across boundaries.

## Ownership map

| Area | Path | Owner agent role |
|------|------|------------------|
| Shared contracts | `packages/contracts/` | Contracts / integrator only |
| Mobile app | `apps/mobile/` | Mobile agent |
| Vision API | `services/vision-api/` | Backend / vision agent |
| Docs & plans | `docs/`, `TASKS.md`, root `README.md` | Planner / integrator |
| Cursor rules | `.cursor/rules/` | Planner / integrator |

**Rule:** No agent edits another owner’s tree without explicit instruction from the planner or user.

---

## Phase 0 — Foundation (done / maintained by integrator)

- [x] Monorepo layout: `apps/mobile`, `services/vision-api`, `packages/contracts`, `docs`, `.cursor/rules`
- [x] Shared types + JSON Schemas for API and domain models
- [x] Architecture diagram and this task list

## Phase 1 — Contracts freeze for integration

**Depends on:** Phase 0  
**Owner:** Integrator (with mobile + backend sign-off)

- [ ] Confirm `AnalyzeFrame*` and `AnalyzeVideoReplay*` field names with both clients
- [ ] Add optional OpenAPI bundle if tools need a single file (optional)
- [ ] Version bump policy for breaking contract changes (document in README)

## Phase 2 — Vision API skeleton

**Depends on:** Phase 1  
**Owner:** Backend / vision  
**Blocks:** Mobile live/replay integration

- [ ] FastAPI app with `POST /analyze-frame` and `POST /analyze-video-replay` wired to request/response models matching contracts
- [ ] Stub OpenCV pipeline (classical CV only — **no deep learning** for lane MVP)
- [ ] Health check endpoint for deploy/hackathon demos
- [ ] Local run docs (port, env vars)

## Phase 3 — Mobile shell + navigation

**Depends on:** Phase 1  
**Owner:** Mobile

- [ ] Expo app boots, TypeScript strict, depends on `@roadcopilot/contracts`
- [ ] Screen stubs: pre-drive route choice, active drive, post-trip summary, settings/disclaimers
- [ ] **Advisory-only** copy and **supportive tone** on all visible strings (see `.cursor/rules`)

## Phase 4 — Safe routing (MVP required)

**Depends on:** Phase 3  
**Owner:** Mobile (routing provider integration)  
**May consult:** Backend if server-side scoring is added later

- [ ] Produce at least two `RouteOption` instances for a destination (real or mocked provider)
- [ ] Persist `routeOptionId` on the active trip
- [ ] Calm rationales required on every option

## Phase 5 — Lane drift + frame client

**Depends on:** Phase 2, Phase 3  
**Owner:** Mobile (camera + TTS) + Backend (CV)

- [ ] Mobile: capture frames at agreed rate; **only one** `/analyze-frame` in flight
- [ ] Map `AnalyzeFrameResponse` to spoken/UI alerts (non-startling)
- [ ] Backend: return plausible `lane` + `advisory` for demo

## Phase 6 — Sensor events

**Depends on:** Phase 3  
**Owner:** Mobile

- [ ] Implement thresholding for hard brake, rapid accel, sharp swerve
- [ ] Emit `TripEvent` records with stable `id` and UTC `occurredAt`
- [ ] Optional: correlate with lane advisories without blaming the driver

## Phase 7 — Family summary (MVP required)

**Depends on:** Phase 4, Phase 6  
**Owner:** Mobile (first); Backend optional for cloud sync later

- [ ] Build `FamilySummary` from trip timeline + rollups
- [ ] Supportive `headline` and `highlights`; no punitive language
- [ ] If replay was used for lane segment, set `derivedFromReplay`

## Phase 8 — Replay / demo path

**Depends on:** Phase 2, Phase 5  
**Owner:** Mobile + Backend

- [ ] Mobile: upload or URL flow matching `AnalyzeVideoReplayRequest`
- [ ] Backend: sample frames from video; reuse same advisory semantics as live frames where possible
- [ ] Clear in-app labeling that demo/replay is not a live drive

---

## Critical path (shortest hackathon sequence)

1. Phase 1 sign-off on contracts  
2. Phase 2 + Phase 3 in parallel  
3. Phase 4 → Phase 6 (can overlap after Phase 3)  
4. Phase 5 when API is up  
5. Phase 7 → Phase 8 for polish and judge demos  

---

## Explicit non-goals for MVP

- Autonomous driving or any control of vehicle systems
- Deep-learning lane models
- Punitive scoring or “driver grading” language
