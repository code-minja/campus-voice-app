# 🎙 Campus Voice — Project Handover & System Architecture Guide

This document provides a detailed overview of the **Campus Voice** system architecture, core services, client applications, operational workflows, and the future development roadmap. It is designed to onboard new developers and maintainers to the codebase.

---

## 1. System Overview & Architecture

**Campus Voice** is an AI-powered voice-guided navigation ecosystem tailored for the **Adekunle Ajasin University, Akungba-Akoko (AAUA)** campus. The system allows users (particularly students and visitors, with optimization for accessibility/blind navigation) to navigate campus walkways hands-free by speaking destination requests and receiving voice-guided, step-by-step turn instructions.

The system is structured as two primary modules:

```mermaid
graph TD
    subgraph Clients ["Client Layer"]
        Mobile["React Native Expo App (campus-voice)"]
    end

    subgraph API ["Backend API Layer (python-api/campus-voice)"]
        FastAPI["FastAPI Web Framework"]
        Lifespan["Lifespan Service Manager"]
    end

    subgraph Services ["Core Engine Layer"]
        STT["Speech-to-Text (faster-whisper)"]
        TTS["Text-to-Speech (Kokoro 82M ONNX)"]
        Router["Routing Service (AAUA Walkway Dijkstra vs. Google Routes API)"]
        Geofence["AAUA Campus Geofencing Constraint"]
    end

    Mobile -->|Upload Voice (.m4a)| FastAPI
    Mobile -->|Query Route (lat/lng, dest)| FastAPI
    Mobile -->|Synthesize Voice (text)| FastAPI
    
    FastAPI --> Lifespan
    Lifespan --> STT
    Lifespan --> TTS
    Lifespan --> Router
    Lifespan --> Geofence
```

### Components Summary

1. **`campus-voice` (React Native Expo App)**: The primary end-user mobile application. It captures user audio inputs, queries the backend for transcription and routing, snaps the user to steps on the active map path, and handles hands-free voice feedback.
2. **`python-api/campus-voice` (FastAPI Backend)**: The server orchestrator. It handles deep learning models (STT/TTS) and geofenced Dijkstra/Google mapping queries.

---

## 2. Python API Backend Details

The backend is built in **Python 3.11** using the **FastAPI** web framework. Dependencies are managed via the high-performance **`uv`** package manager.

### 2.1 Speech-to-Text (STT) Service
- **Model**: `faster-whisper` (utilizing the CTranslate2 engine for fast, efficient transformer inference on CPU/GPU).
- **Default Size**: `base` (can be configured from `tiny` up to `large-v3` via env variables).
- **Optimization**: Uses NumPy 1.x compatibilities and runs with `int8` quantization to keep RAM usage low (~250MB on CPU).
- **Implementation**: Managed in [stt_service.py](../python-api/campus-voice/src/campus_voice/services/stt_service.py). Pre-warmed during API startup.

### 2.2 Text-to-Speech (TTS) Service
- **Model**: `Kokoro` 82M ONNX weight model.
- **Benefits**: High-fidelity speech generation at a fraction of the size of conventional models, with no cloud API cost.
- **Available Voices**: `af_heart` (default female), `af_bella`, `am_adam` (default male), `am_michael`, `bf_emma`, `bm_george`.
- **Implementation**: Wrapper code inside [tts_service.py](../python-api/campus-voice/src/campus_voice/services/tts_service.py) parses text and outputs standard `audio/wav` or `audio/mpeg` data streams.

### 2.3 Routing Service
The routing system is coordinated by [service.py](../python-api/campus-voice/src/campus_voice/services/routing/service.py) and is geofenced to the AAUA campus. 

It handles routing through three tiers:

1. **Curated Walkway Routes**:
   - For specific critical routes (e.g., *Faculty of Computing ➔ University Library*, *ETF 750 ➔ University Library*), the service returns pre-authored coordinates and highly descriptive walking guides to ensure 100% path accuracy on walkways.
2. **Mock Walkway Graph (Dijkstra)**:
   - For other campus routes, [mock_provider.py](../python-api/campus-voice/src/campus_voice/services/routing/mock_provider.py) maps the coordinates, snaps the origin to the nearest graph node, runs Dijkstra's algorithm ([dijkstra.py](../python-api/campus-voice/src/campus_voice/services/routing/dijkstra.py)) over a custom AAUA walkway network ([campus_graph.py](../python-api/campus-voice/src/campus_voice/services/routing/campus_graph.py)), and computes relative bearings to emit navigation steps like:
     * *"Turn right towards Faculty of Science for 45 meters"*
3. **Google Routes API Provider**:
   - When `ROUTING_PROVIDER` is set to `google_routes`, [google_routes_provider.py](../python-api/campus-voice/src/campus_voice/services/routing/google_routes_provider.py) queries Google's walking directions matrix. If Google API calls fail, the service automatically falls back to Dijkstra's mock walkway graph.

### 2.4 AAUA Campus Geofencing
- **Center Coordinate**: Latitude `7.479234`, Longitude `5.748411` (Senate Building area).
- **Physical Radius Limit**: `1,000` meters (1.0 km) matching the AAUA boundary.
- **Functionality**: Rejects coordinate routing origins that fall outside this geofence unless `CAMPUS_GEOFENCE_ENABLED=false` or simulated origins are supplied.

---

## 3. Mobile Client (Expo App)

The mobile client is built using **Expo SDK 54**, **React Native**, and **TypeScript**.

### 3.1 Key Modules & Logic
- **Snapping & Distance Engine**: Monitors live location coordinates via `expo-location` and calculates step offsets/bearings using local Levenshtein matching and Jaccard tokens in [campusLocations.ts](src/app/services/campusLocations.ts).
- **Voice Navigation State Hook**: [useVoiceNavigation.ts](src/app/hooks/useVoiceNavigation.ts) manages the active route session, playing speech prompts for upcoming steps, arrivals, or out-of-path errors.
- **Audio Feedback**:
  - [preRecordedAudio.ts](src/app/services/preRecordedAudio.ts) preloads localized sound bytes (e.g., beep, success, error chimes, footstep triggers) to avoid latency.
  - [voiceFeedback.ts](src/app/services/voiceFeedback.ts) plays synthesized TTS or speaks announcements.

### 3.2 Screens Structure
- **`HomeScreen.tsx`**: Startup screen featuring a map background, quick-search suggestion chips, and a prominent mic trigger to start voice routing.
- **`NavigationInputScreen.tsx`**: Shows mic waveforms and real-time state alerts during listening and backend transcription.
- **`RoutePreviewScreen.tsx`**: Displays route summaries, estimated time, and geofence-checks before active navigation starts.
- **`ActiveNavigationScreen.tsx`**: Interactive direction card showing current step, distance, compass, next step indicators, and walking tracks.
- **`VoiceOnlyModeScreen.tsx`**: High-contrast, dark voice assistant view designed for eyes-free navigation.
- **`ArrivalScreen.tsx`**: Triggers success screens and statistics once the final target waypoint is reached.

---

## 4. Developer Workflows & Setup

To make local onboarding simple, the mobile client includes a unified dev orchestration script: [start-all.js](scripts/start-all.js).

### Running Locally
To launch both the backend and frontend at once:
1. Navigate to the mobile app directory: `cd campus-voice`
2. Run the developer startup command:
   ```bash
   npm run dev
   ```

**What the script does under the hood:**
1. **Detects the local IPv4 address** on your host network (e.g. `192.168.1.15`).
2. **Injects the IP address** dynamically into the mobile `.env` file (`EXPO_PUBLIC_API_BASE_URL=http://<IP>:<PORT>`) so the mobile app running on a physical phone or simulator knows how to connect to the backend server.
3. **Checks if Docker is running**:
   - If Docker is running: Launches the backend in dev mode via Docker Compose (`docker compose --profile dev up campus-voice-dev` binding local files for hot-reload on port `8001`).
   - If Docker is not running: Automatically falls back to launching the local Python virtualenv backend (`.venv/bin/uvicorn` on port `8000`).
4. **Starts the Metro Bundler** for the Expo project.

---

## 5. Configuration Matrices

### Backend Configuration (`python-api/campus-voice/.env`)
| Variable | Default | Description |
|---|---|---|
| `ROUTING_PROVIDER` | `mock` | `mock` (Dijkstra) or `google_routes` |
| `GOOGLE_MAPS_API_KEY` | *(None)* | Required if using `google_routes` |
| `WHISPER_MODEL_SIZE` | `base` | Model size for faster-whisper (`tiny` to `large-v3`) |
| `WHISPER_DEVICE` | `cpu` | Hardware logic: `cpu` or `cuda` |
| `CAMPUS_GEOFENCE_ENABLED` | `true` | Enables AAUA geofence boundary checks |
| `ALLOW_SIMULATED_ORIGIN` | `true` | Allows coordinate override for developer testing |

### Mobile App Configuration (`campus-voice/.env`)
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base API endpoint (automatically set by `start-all.js`) |
| `EXPO_PUBLIC_TRANSCRIBE_URL` | Explicit override for the STT endpoint |
| `EXPO_PUBLIC_TTS_URL` | Explicit override for the TTS endpoint |

---

## 6. Future Project Roadmap

1. **Yoruba & Nigerian Accent Optimization**:
   - Prepare local audio recording manifests using `scripts/prepare_stt_manifest.py`.
   - See detailed instructions in [STT_FINE_TUNING.md](../python-api/campus-voice/docs/STT_FINE_TUNING.md) to fine-tune Whisper on Yoruba names and local accents.
2. **Streaming Text-to-Speech (SSE)**:
   - Replace the static file TTS endpoint with a streaming Server-Sent Events (SSE) audio playback pipeline to decrease time-to-first-sound.
3. **WebSocket Audio Integration**:
   - Create full-duplex WebSocket connections for direct audio stream transcribing, cutting out multi-part file uploads completely.
