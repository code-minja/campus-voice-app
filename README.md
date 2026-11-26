# 📱 CampusVoice — AI-Powered Voice-Guided Campus Navigation

**CampusVoice** is an AI-powered, voice-guided mobile navigation application built with **React Native, Expo SDK 58 and TypeScript**. It is designed to help blind and low-vision individuals navigate campus environments more independently through natural voice interaction and spoken navigation instructions.

The application currently supports **Adekunle Ajasin University (AAUA), Akungba-Akoko, Nigeria**, using a locally mapped campus walkway network and location database.

CampusVoice integrates speech recognition, text-to-speech, GPS tracking, intelligent destination matching and dynamic route recalculation to deliver a hands-free navigation experience.

The mobile application communicates with a deployed **FastAPI backend**, which handles speech-to-text (STT), text-to-speech (TTS), location retrieval and route processing.

> **Current coverage:** CampusVoice is currently configured for navigation within the AAUA campus. Its location database and walkway network are specific to this environment.

---

## ✨ Key Features

- **Voice-First Interaction:** Users can request destinations through spoken commands without depending on conventional visual navigation interfaces.
- **AI-Powered Speech Recognition:** Uses Whisper Tiny through the FastAPI backend to convert spoken destination requests into text.
- **Intelligent Destination Matching:** Identifies campus destinations using fuzzy matching, token similarity and edit-distance algorithms.
- **Voice-Based Destination Confirmation:** Reads back the identified destination and requests confirmation before navigation begins.
- **GPS-Based Live Tracking:** Monitors the user's current location and movement throughout the journey.
- **Walking Route Calculation:** Computes walking routes using the mapped campus walkway network.
- **Route Snapping:** Matches the user's GPS position to the nearest suitable walkway segment.
- **Dynamic Rerouting:** Detects deviations from the recommended route and automatically calculates an alternative route.
- **Real-Time Spoken Guidance:** Announces navigation instructions, route progress, distance updates and arrival information.
- **Text-to-Speech:** Uses Kokoro-82M to convert navigation instructions into spoken audio.
- **Voice-Only Navigation Mode:** Provides a simplified, high-contrast interface for hands-free interaction.
- **Saved Locations:** Allows users to access frequently visited campus destinations.

---

## 🧠 AI and Speech Technology

CampusVoice uses speech AI to make navigation more accessible and natural.

### 1. Speech-to-Text (STT) — Whisper Tiny

Whisper Tiny processes spoken user requests and converts them into text that the application can interpret.

For example:

- "Take me to the library."
- "Navigate to ETF."
- "I want to go to the Faculty of Science."

We have collected voice samples from students in both noisy and quiet campus environments and used them to adapt the speech recognition system to real-world campus conditions.

### 2. Text-to-Speech (TTS) — Kokoro-82M

Kokoro-82M converts navigation instructions and system responses into spoken audio.

This allows users to receive directions without constantly interacting with or viewing the mobile screen.

The speech component is integrated into the application's voice feedback service, with support for generated speech and pre-recorded audio cues.

### 3. Locally Adapted Speech Experience

Our speech development approach incorporates voice samples collected from students within the AAUA campus environment.

The objective is to improve speech recognition and speech generation for practical campus use, accounting for differences between quiet and noisy environments.

We also aim to extend CampusVoice's multilingual capabilities to support Nigerian languages, including Yoruba, Igbo, Hausa and Nigerian Pidgin.

---

## 🛠 Technology Stack

| Component | Technology |
|---|---|
| Mobile framework | React Native |
| Development platform | Expo SDK 58 |
| Programming language | TypeScript |
| Backend | Python, FastAPI |
| Speech recognition | Whisper Tiny |
| Speech synthesis | Kokoro-82M |
| Location tracking | Device GPS |
| Mapping | Google Maps integration |
| Routing | Walking-route and walkway network processing |
| Destination matching | Jaccard similarity and Levenshtein distance |
| API communication | REST APIs |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

- Node.js 22.13+, 24.3+ or 26+
- npm
- Expo Go on a physical Android or iOS device, or an appropriate local emulator
- Docker (optional, for containerized backend development)

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd campus-voice-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Application

```bash
npm start
```

Scan the generated Expo QR code using Expo Go to launch CampusVoice on your physical device.

**Important:** The deployed backend is already configured for the current application. The standard `npm start` command launches the Expo development server and connects to the configured backend.

### 4. Running the Complete Development Environment Locally

The project includes an orchestration script that detects your computer's local network IP address and starts the required development services.

Run:

```bash
npm run dev
```

On Windows PowerShell, if the execution policy blocks npm commands, use:

```powershell
npm.cmd install
npm.cmd run dev
```

The orchestration script (`scripts/start-all.js`) performs the following operations:

1. Detects your computer's local network IPv4 address.
2. Generates or updates the `.env` configuration with the appropriate API base URL.
3. Starts the local FastAPI backend, using Docker where available or a Python virtual environment as a fallback.
4. Launches the Expo Metro bundler.

Scan the generated QR code with Expo Go to access the mobile application.

---

## 📁 Project Structure

```text
campus-voice-app/
│
├── assets/                         # Static images and application assets
│
├── scripts/
│   └── start-all.js                # Development environment orchestrator
│
├── src/
│   └── app/
│       ├── App.tsx                 # Navigation container and stack
│       │
│       ├── components/
│       │   ├── CampusMapBackdrop.tsx
│       │   ├── GoogleRouteMap.tsx
│       │   ├── VoiceButton.tsx
│       │   └── VoiceWaveIndicator.tsx
│       │
│       ├── hooks/
│       │   ├── useLiveLocation.ts
│       │   └── useVoiceNavigation.ts
│       │
│       ├── screens/
│       │   ├── HomeScreen.tsx
│       │   ├── NavigationInputScreen.tsx
│       │   ├── RoutePreviewScreen.tsx
│       │   ├── ActiveNavigationScreen.tsx
│       │   ├── VoiceOnlyModeScreen.tsx
│       │   └── SavedLocationsScreen.tsx
│       │
│       └── services/
│           ├── backendConfig.ts
│           ├── campusLocations.ts
│           └── voiceFeedback.ts
│
├── package.json
└── tsconfig.json
```

---

## 🧭 How CampusVoice Works

CampusVoice follows a voice-first navigation workflow designed to minimise the need for visual interaction.

### Step 1: Voice-Based Destination Request

When the user opens the application, CampusVoice prompts:

*"Where would you like to go?"*

The user responds with their preferred destination through the microphone.

### Step 2: Speech Recognition and Destination Matching

The recorded audio is sent to the FastAPI backend for transcription using Whisper Tiny.

The application then matches the transcribed request against available campus locations using fuzzy search algorithms.

If multiple destinations have similar matching scores, the user is prompted to clarify their choice.

### Step 3: Destination Confirmation

Once a suitable destination is identified, CampusVoice announces it and requests confirmation.

The user confirms by saying "Yes" before the application proceeds to route calculation.

### Step 4: Route Calculation

The application retrieves the user's current GPS location and requests a walking route to the selected destination.

It calculates route distance, estimated travel duration and the sequence of navigation instructions using the campus walkway network.

### Step 5: Active Voice-Guided Navigation

During navigation, CampusVoice:

- Monitors the user's live GPS position.
- Tracks movement along the calculated route.
- Announces upcoming navigation instructions.
- Provides distance and progress updates.
- Advances instructions as the user approaches route waypoints.

### Step 6: Automatic Rerouting

When the application detects that the user has moved away from the recommended route, it triggers automatic route recalculation.

The current implementation requires three consecutive accurate GPS readings indicating a deviation greater than 5 metres before initiating a reroute.

The user then receives updated spoken instructions.

### Step 7: Arrival Notification

When the user reaches the configured destination radius, CampusVoice announces arrival.

---

## ⚙️ Core Navigation Algorithms

### 1. Destination Matching and Resolution

Implemented in:

`campusLocations.ts`

The application uses three matching techniques to identify destinations from transcribed speech:

**Jaccard Token Overlap**

Compares the words in the user's request with destination names and their aliases to determine similarity.

**Levenshtein Distance**

Measures the number of character-level edits required to transform one string into another, helping identify destinations despite spelling or transcription differences.

**Navigation Phrase Filtering**

Removes common navigation expressions such as:

- "Take me to..."
- "I am going to..."
- "Navigate to..."

This helps isolate the actual destination.

**Matching threshold:** Candidates with a confidence score below `0.78` are rejected and the user is asked to repeat the destination.

When multiple candidates have closely matched scores, the application requests clarification through voice interaction.

### 2. Live Route Tracking and Rerouting

Implemented in:

`routeTracking.ts`

The navigation engine continuously monitors the user's GPS position and compares it with the calculated walking route.

Its core operations include:

- GPS position monitoring.
- Filtering location updates with poor reported accuracy.
- Calculating perpendicular distance to the nearest route segment.
- Matching the user's position to the mapped walkway.
- Tracking progress across route waypoints.
- Triggering spoken instructions at configured distance thresholds.
- Prefetching upcoming speech responses.
- Detecting route deviations and initiating automatic rerouting.
- Announcing arrival when the user enters the configured destination radius.

**Default navigation parameters:**

| Parameter | Default value |
|---|---:|
| Off-route confirmation count | 3 readings |
| Off-route threshold | 5 metres |
| Minimum acceptable GPS accuracy | 10 metres |
| Progress announcement interval | 25 metres |
| Arrival radius | 15 metres |

---

## 🔧 Environment Configuration

The application supports environment-based API configuration.

Create a `.env` file in the project root when manual configuration is required.

```env
EXPO_PUBLIC_API_BASE_URL=https://campusvoice.dpdns.org

EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:8000


EXPO_PUBLIC_TRANSCRIBE_URL=http://192.168.1.15:8000/v1/stt/transcribe

EXPO_PUBLIC_TTS_URL=http://192.168.1.15:8000/v1/tts/synthesize
```

Replace the example IP address with your actual backend address when running locally.

### Google Maps Configuration

For web map rendering, configure:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID=your_google_maps_map_id
```

Enable the Google Maps JavaScript API and billing in Google Cloud.

For native Android and iOS builds, provide platform-specific keys:

```env
GOOGLE_MAPS_ANDROID_API_KEY=your_android_api_key

GOOGLE_MAPS_IOS_API_KEY=your_ios_api_key
```

If platform-specific keys are omitted, the application falls back to the general Google Maps API key.

Restrict API keys appropriately and rebuild native applications after changing native key configurations.

### Navigation Configuration

Navigation tracking can be customised through optional `EXPO_PUBLIC_NAVIGATION_*` environment variables documented in `.env.example`.

Restart Expo after making environment configuration changes.

---

## ♿ Accessibility and Inclusion

CampusVoice is designed around the principle that accessibility should be integrated into the product from the beginning.

Its development prioritises:

- Voice-based destination selection.
- Spoken destination confirmation.
- Audio navigation instructions.
- Hands-free navigation.
- A simplified, high-contrast voice-only interface.
- Reduced dependence on visual maps and directional signs.
- User-centred testing with persons with visual impairment.

We have involved a person with visual impairment as a validator and tester, ensuring that lived experience informs the development and improvement of the application.

Our broader vision includes multilingual voice interaction to make navigation more accessible to people with different language backgrounds across Nigeria.

---

## 🗺 Current Coverage and Future Direction

**Current implementation**

- AAUA campus-specific location database.
- Locally mapped campus walkways.
- Whisper Tiny speech recognition integration.
- Kokoro-82M speech synthesis integration.
- Voice-based destination resolution and confirmation.
- GPS-based walking navigation.
- Automatic route deviation detection and rerouting.
- Real-time spoken navigation guidance.

**Planned improvements**

- Expanded support for Yoruba, Igbo, Hausa and Nigerian Pidgin.
- Further speech-model adaptation and evaluation.
- Improved environmental awareness and navigation safety.
- Expanded accessibility testing with more persons with visual impairment.
- Extension of the navigation database to additional environments.

---

## 🎯 Our Vision

We believe that access to mobility, education and everyday opportunities should not be limited by visual impairment.

CampusVoice aims to make navigating unfamiliar environments more accessible by combining locally relevant mapping, speech AI and inclusive product design.

**We are building with persons with visual impairment, not just for them.**

