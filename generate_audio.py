#!/usr/bin/env python3
"""
Generate pre-recorded audio files from your Kokoro backend

Usage:
    python generate_audio.py
"""

import requests
import json
from pathlib import Path
import sys

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BACKEND_URL = "http://localhost:8000"  # Change if hosted elsewhere
OUTPUT_DIR = Path("assets/audio")

AUDIO_MAP = {
    # Feedback
    "feedback/listening": "Listening now. Please speak.",
    "feedback/processing": "Processing your voice.",
    "feedback/no_speech": "No speech detected. Please try again.",
    "feedback/understood": "Got it.",
    "feedback/error": "Something went wrong. Please try again.",
    "feedback/permission": "Microphone access required.",
    "feedback/timeout": "Sorry, that took too long. Please try again.",

    # Destinations
    "destinations/library": "Take me to the library.",
    "destinations/center": "Take me to the student center.",
    "destinations/cafeteria": "Take me to the cafeteria.",
    "destinations/gym": "Take me to the gym.",
    "destinations/health_center": "Take me to the health center.",

    # Navigation
    "navigation/navigation_start": "Navigation started. Follow the directions.",
    "navigation/arrived": "You have arrived at your destination.",
    "navigation/turn_left": "Turn left.",
    "navigation/turn_right": "Turn right.",
    "navigation/continue_straight": "Continue straight.",
    "navigation/slight_left": "Slight left.",
    "navigation/slight_right": "Slight right.",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def generate_audio():
    print(f"🎵 Generating audio files...\n")
    print(f"Backend: {BACKEND_URL}")
    print(f"Output: {OUTPUT_DIR}\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    success = 0
    failed = 0

    for path, text in AUDIO_MAP.items():
        file_path = OUTPUT_DIR / f"{path}.wav"
        file_path.parent.mkdir(parents=True, exist_ok=True)

        print(f"Generating: {path:40}", end=" ")
        sys.stdout.flush()

        try:
            response = requests.post(
                f"{BACKEND_URL}/v1/tts/synthesize",
                json={"text": text, "format": "wav"},
                timeout=30,
            )

            if response.ok:
                with open(file_path, "wb") as f:
                    f.write(response.content)

                size_kb = file_path.stat().st_size / 1024
                print(f"✅ ({size_kb:.1f}KB)")
                success += 1
            else:
                print(f"❌ {response.status_code} {response.reason}")
                failed += 1
        except Exception as e:
            print(f"❌ {str(e)[:40]}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"✅ Success: {success}")
    print(f"❌ Failed:  {failed}")
    print(f"Total:     {success + failed}")
    print(f"{'=' * 60}")

    if success > 0:
        print(f"\n✅ Audio files ready in: {OUTPUT_DIR}")
        print(f"   Now update AUDIO_ASSETS in preRecordedAudio.ts")
    else:
        print(f"\n❌ No audio files generated!")
        print(f"   Check backend is running at {BACKEND_URL}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        generate_audio()
    except KeyboardInterrupt:
        print("\n⚠️  Cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)