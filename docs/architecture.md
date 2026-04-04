# RoadCopilot architecture

This document describes how the mobile app, vision API, and shared contracts fit together. It is the integration reference for hackathon-style delivery.

## System context

```mermaid
flowchart LR
  subgraph phone["Phone — apps/mobile"]
    UI[UI]
    Sensors[Sensors]
    Camera[Camera]
    LocalTrip[Trip + events store]
  end
  subgraph backend["services/vision-api"]
    API[FastAPI]
    CV[OpenCV lane — classical CV]
    Replay[Video replay processor]
  end
  Contracts["packages/contracts"]
  UI --> Contracts
  API --> Contracts
  Sensors --> LocalTrip
  Camera --> API
  Replay --> CV
  API --> CV
```

## Route selection flow (pre-drive, MVP required)

Safe routing is a **required** MVP feature: the driver sees ranked **route options** with calm rationales before starting.

```mermaid
sequenceDiagram
  participant D as Driver
  participant App as Mobile app
  participant Route as Routing provider / local heuristic
  D->>App: Enter destination
  App->>Route: Request candidate routes
  Route-->>App: Raw route candidates
  App->>App: Score + label options (RouteOption)
  App-->>D: Show options + supportive rationale
  D->>App: Confirm preferred route
  App->>App: Store chosen routeOptionId on trip
```

*Note:* Backend may assist with scoring later; the **`RouteOption` contract** is the cross-team handshake regardless of where scoring runs.

## Live camera frame flow (lane advisory)

Lane drift uses **on-device** sensing where possible; the **vision API** handles frame analysis and aligns with **replay mode**. The mobile client must keep **at most one** `POST /analyze-frame` request in flight.

```mermaid
sequenceDiagram
  participant Cam as Camera
  participant App as Mobile app
  participant API as vision-api
  participant CV as OpenCV pipeline
  Cam->>App: Frame sample
  App->>App: Enforce single in-flight frame request
  App->>API: POST /analyze-frame (AnalyzeFrameRequest)
  API->>CV: Decode + classical lane cues
  CV-->>API: offsets / confidence
  API-->>App: AnalyzeFrameResponse
  App->>App: TTS / UI advisory (calm, elder-focused)
```

## Sensor event flow (on-device)

Hard braking, rapid acceleration, and sharp swerves are detected **on the phone** using IMU/GPS-derived signals. Events conform to **`TripEvent`** and feed the post-trip summary.

```mermaid
flowchart TD
  IMU[Accelerometer / gyro]
  GPS[GPS speed / heading]
  Fuse[Fusion / thresholds]
  Store[(Trip events)]
  Summary[Family summary builder]
  IMU --> Fuse
  GPS --> Fuse
  Fuse -->|"TripEvent"| Store
  Store --> Summary
```

## Trip summary flow (post-trip, MVP required)

The **family summary** is **required** for MVP. Copy must be **supportive and non-punitive**. Replay/demo trips set `derivedFromReplay` when appropriate.

```mermaid
flowchart LR
  subgraph tripEnd["End of trip"]
    E[Events + route meta]
    B[Build FamilySummary]
    F[Family view]
  end
  E --> B --> F
```

## Replay / demo backup mode

When live camera is unavailable, the app uses **`POST /analyze-video-replay`** so judges or caregivers can run a **demo** path. Responses use **`AnalyzeVideoReplayResponse`**; downstream UX should label demo/replay clearly without alarming the driver.

---

## Contract map

| Endpoint / artifact | TypeScript + JSON Schema |
|---------------------|---------------------------|
| `POST /analyze-frame` | `AnalyzeFrameRequest` / `AnalyzeFrameResponse` |
| `POST /analyze-video-replay` | `AnalyzeVideoReplayRequest` / `AnalyzeVideoReplayResponse` |
| Trip log | `TripEvent` |
| Family UI | `FamilySummary` |
| Pre-drive routes | `RouteOption` |

All live under `packages/contracts/` (`src/` and `schemas/`).
