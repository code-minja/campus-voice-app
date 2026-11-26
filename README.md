# 📱 Campus Voice — React Native Expo Mobile Client

An interactive React Native mobile application built with **Expo SDK 58** and **TypeScript**. It serves as the primary front-end interface for the **Campus Voice** voice-guided navigation ecosystem, supporting AAUA (Adekunle Ajasin University, Akungba-Akoko) campus walkways.

The application captures microphone inputs, transcribes them using the FastAPI backend STT, computes routing tracks, snaps the user to walkways, and provides real-time spoken guidance for hands-free navigation.

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (22.13+, 24.3+, or 26+; required by Expo SDK 58)
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

In Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if the execution policy blocks the `npm` PowerShell shim.

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

Matches below `0.78` are rejected and the app asks the user to repeat the destination. If the best candidates are close in confidence, it asks the user to choose one by voice. A confident match is read back for confirmation before route preview.

### 2. Live Route Tracking (`routeTracking.ts`)
The app reads the device's live GPS position, requests a walking route, and tracks perpendicular distance to the nearest polyline segment. It ignores fixes with poor reported accuracy, advances instructions as the user approaches route waypoints, prefetches upcoming speech, and announces progress as distance thresholds are reached. Three consecutive accurate readings more than 5 m off-route trigger an automatic reroute. Arrival is announced once inside the configured radius.

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

Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in the ignored `.env.local` file to display
Google Maps on web. Enable Maps JavaScript API and billing in Google Cloud, and
restrict the key to your app's HTTP referrers. The web app draws the route
returned by the backend from the device's live location. For native builds,
provide separate `GOOGLE_MAPS_ANDROID_API_KEY` and
`GOOGLE_MAPS_IOS_API_KEY` values restricted to the app's package/signing
certificate and bundle ID, respectively. If these are omitted, native builds
fall back to `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Rebuild the native app after
changing native keys. The web map uses satellite imagery and
`google.maps.marker.AdvancedMarkerElement`; set `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID`
to a Map ID from Google Cloud for production (the development default is
`DEMO_MAP_ID`). The route preview and active navigation calculate arrival time
from the live route duration and remaining route distance.

Navigation tracking can be tuned in `.env.local` with the optional
`EXPO_PUBLIC_NAVIGATION_*` settings documented in `.env.example`. The default
off-route confirmation count is 3, threshold is 5 m, minimum acceptable GPS
accuracy is 10 m, progress announcement interval is 25 m, and arrival radius
is 15 m. Restart Expo after changing environment values.
