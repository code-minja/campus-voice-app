# 📱 Campus Voice — React Native Expo Mobile Client

An interactive React Native mobile application built with **Expo SDK 54** and **TypeScript**. It serves as the primary front-end interface for the **Campus Voice** voice-guided navigation ecosystem, supporting AAUA (Adekunle Ajasin University, Akungba-Akoko) campus walkways.

The application captures microphone inputs, transcribes them using the FastAPI backend STT, computes routing tracks, snaps the user to walkways, and provides real-time spoken guidance for hands-free navigation.

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- **Expo Go** app installed on your physical mobile device (Android or iOS) for quick testing, OR local emulators (Android Studio / Xcode).
- **Docker** (optional, to run the backend in container mode).

---

## 🚀 Getting Started

### 1. Installation

Clone this repository and install the project dependencies:

```bash
cd campus-voice
npm install
```

### 2. Running Locally

The project is equipped with a developer orchestration script that dynamically detects your local IP and boots both backend and mobile bundlers in one step.

To run:
```bash
npm run dev
```

**Under the hood, this launches `scripts/start-all.js`, which:**
1. Detects your computer's local network IPv4 address (e.g. `192.168.1.15`).
2. Automatically generates or updates a `.env` file in this directory with `EXPO_PUBLIC_API_BASE_URL=http://<YOUR_IP>:8000` (or `8001` if running containerized).
3. Launches the local FastAPI backend (containerized if Docker daemon is active, or via a Python virtual environment as fallback).
4. Launches the Expo Metro bundler.

Scan the generated QR code in your terminal with your phone's camera (iOS) or the Expo Go app (Android) to open the app.

---

## 📁 Project Directory Structure

```
campus-voice/
├── assets/                    # Static image/icon assets
├── scripts/
│   └── start-all.js           # Network-aware dev startup orchestrator
├── src/app/
│   ├── App.tsx                # React Navigation Container & stack definition
│   ├── components/            # Reusable UI controls
│   │   ├── CampusMapBackdrop.tsx # Renders background maps with visual overlays
│   │   ├── GoogleRouteMap.tsx # Renders path polylines and snapping points
│   │   ├── VoiceButton.tsx    # Interactive voice microphone action button
│   │   └── VoiceWaveIndicator.tsx # Visual speech animation
│   ├── hooks/
│   │   ├── useLiveLocation.ts # Monitors GPS coordinates and maps them
│   │   └── useVoiceNavigation.ts # Manages voice guidance triggers and route steps
│   ├── screens/               # Screen definitions
│   │   ├── HomeScreen.tsx     # Startup screen and suggestion chips
│   │   ├── NavigationInputScreen.tsx # Speech-to-text listener view
│   │   ├── RoutePreviewScreen.tsx # Summary view (Distance, Duration)
│   │   ├── ActiveNavigationScreen.tsx # Interactive turn card and map tracker
│   │   ├── VoiceOnlyModeScreen.tsx # Dark high-contrast hands-free view
│   │   └── SavedLocationsScreen.tsx # Favorites view
│   └── services/              # Core business services
│       ├── backendConfig.ts   # URL normalization and API endpoint configurations
│       ├── campusLocations.ts # Fuzzy search matching and local location cache
│       └── voiceFeedback.ts   # Integrates TTS synthesis and pre-recorded chimes
├── package.json
└── tsconfig.json
```

---

## 🧭 Key Client Algorithms

### 1. Destination Matching & Resolver (`campusLocations.ts`)
When a user says a destination (e.g., *"Take me to the library"* or *"Go to ETF"*), the app fetches the location list from the backend `/v1/locations` API and performs fuzzy match scoring client-side using three heuristics:
- **Jaccard Token Overlap**: Tokenizes the input words and checks percentage overlap against candidate names and aliases.
- **Levenshtein Distance**: Measures editing distance on compacted alphanumeric names.
- **Candidate Phrasing Filters**: Automatically strips out navigation carrier phrases (e.g., *"take me to"*, *"i am going to"*, *"navigate to"*).

If a match score exceeds `0.78`, the coordinate is resolved. Otherwise, the app redirects the user to the `SearchResults` or `ErrorState` screen with suggested matches.

### 2. Spoken Turn Snapping (`useVoiceNavigation.ts`)
During active navigation, the app tracks the user's live coordinates. It snaps the user to the generated coordinate path array:
- Checks if the user is within a small radius of the current step waypoint.
- Triggers voice announcements for the next navigation instruction (e.g., *"Turn left towards Faculty of Science"*).
- Detects if the user has drifted off the walkway track, playing an error chime and notifying the user.

---

## ⚙️ Environment Configuration

You can customize the API endpoints by creating a `.env` file in the root directory:

```env
# Automatically configured by npm run dev, but can be explicitly set:
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:8000

# Explicit overrides (optional)
EXPO_PUBLIC_TRANSCRIBE_URL=http://192.168.1.15:8000/v1/stt/transcribe
EXPO_PUBLIC_TTS_URL=http://192.168.1.15:8000/v1/tts/synthesize
```
