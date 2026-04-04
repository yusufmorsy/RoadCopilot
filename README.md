# RoadCopilot

RoadCopilot is a phone-based retrofit driving copilot for older drivers and their families. It focuses on **safe routing before the drive**, **lane-drift awareness** (spoken, calm alerts), **phone sensor events** (hard braking, rapid acceleration, sharp swerves), and a **supportive post-trip family summary**. The product is **advisory only**—it does not control the vehicle.

## Monorepo layout

| Path | Purpose |
|------|---------|
| `apps/mobile` | React Native (Expo) + TypeScript client |
| `services/vision-api` | Python FastAPI — frame and video replay analysis (OpenCV MVP) |
| `packages/contracts` | Shared API and domain types + JSON Schemas |
| `docs/` | Architecture and integration references |
| `.cursor/rules/` | Agent and contributor guardrails |

See [docs/architecture.md](docs/architecture.md) for flows (routing, camera frames, sensors, summaries) and [TASKS.md](TASKS.md) for phased work and ownership.

## Prerequisites

- **Node.js** 18+ and npm (20+ recommended for long-term Expo support)
- **Python** 3.11+ (for `services/vision-api`)
- **iOS Simulator** (Xcode) or **Android Studio** / device for the Expo app

## Local development (placeholder)

### 1. Install JavaScript dependencies

From the repository root:

```bash
npm install
npm run build:contracts
```

Rebuild contracts after any change under `packages/contracts/src/`.

### 2. Run the mobile app

```bash
cd apps/mobile
npx expo start
```

Then press `i` / `a` for iOS or Android, or scan the QR code with Expo Go.

Shared types are imported from `@roadcopilot/contracts` (resolved via npm workspaces).

### 3. Run the vision API

```bash
cd services/vision-api
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- Health: `GET http://127.0.0.1:8000/health`
- Frame stub: `POST http://127.0.0.1:8000/analyze-frame` with JSON matching `AnalyzeFrameRequest` in `packages/contracts`
- Replay stub: `POST http://127.0.0.1:8000/analyze-video-replay`

JSON field names use **camelCase** to match the shared contracts.

### 4. Point the app at the API (upcoming)

The mobile client will read a configurable base URL (for example `EXPO_PUBLIC_VISION_API_URL`). Wire this when implementing the frame client; until then the API and app run independently.

## Contracts

TypeScript definitions live in `packages/contracts/src/`. JSON Schema mirrors live in `packages/contracts/schemas/`. Keep them in sync when changing payloads.

## Contributing / agents

Cursor rules under `.cursor/rules/` define advisory-only scope, tone, lane MVP constraints (no deep learning), single in-flight frame request, and file ownership. Follow [TASKS.md](TASKS.md) for dependency order between mobile, vision API, and contracts.
