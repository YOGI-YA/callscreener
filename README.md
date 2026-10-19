# AegisCall AI: Enterprise & Industry-Grade Call Screener & Spam Defense

[![CI Test Suite](https://github.com/YOGI-YA/callscreener/actions/workflows/ci.yml/badge.svg)](https://github.com/YOGI-YA/callscreener/actions/workflows/ci.yml)
[![Build Android APK](https://github.com/YOGI-YA/callscreener/actions/workflows/android-build.yml/badge.svg)](https://github.com/YOGI-YA/callscreener/actions/workflows/android-build.yml)

AegisCall AI is an enterprise, industry-grade Android call-screening and robocall defense engine engineered as an exact replica of premier systems like **Google Pixel Call Screen**, **Truecaller Assistant**, **Apple Live Voicemail**, and **Samsung Bixby Text Call**. It intercepts incoming telephone calls in real-time on physical Android devices, performs multi-turn conversational AI screening, verifies caller authenticity via STIR/SHAKEN cryptographic attestations, isolates device microphone audio to prevent ambient room leakage, and enforces automated telecom verdicts (`ALLOW`, `SILENCE`, or `REJECT`) within strict OS response deadlines.

---

## 🏗️ Architecture Overview

```
                                  +-------------------------------------------------------+
                                  |             Physical Android Device (OS)              |
                                  |                                                       |
  [ Incoming Cellular Call ] ---->|  Telecom Framework -> RoleManager (ROLE_CALL_SCREENING)
                                  |         |                                             |
                                  |         v                                             |
                                  |  +-------------------------------------------------+  |
                                  |  |  Native Kotlin AiCallScreeningService.kt        |  |
                                  |  |  - Stage 0: STIR/SHAKEN Carrier ID Attestation  |  |
                                  |  |  - Stage 1: Ultra-fast local LRU Cache (<1ms)   |  |
                                  |  |  - Stage 2: Asynchronous Coroutine AI Screening  |  |
                                  |  +-------------------------------------------------+  |
                                  |         |                             |               |
                                  |    (Network OK)                 (Timeout / Fallback)  |
                                  |         |                             |               |
                                  |         v                             v               |
                                  |   Node.js Hardened API        Fast Local Rules Engine |
                                  |   /api/screen-call            Heuristics & Threat DB  |
                                  |   - HMAC & Replay Defense     - Strict Regex Rules    |
                                  |   - Token Bucket Rate Limit   - Emergency Whitelist   |
                                  |   - Prompt Injection Defense  - High-Risk Blocklist   |
                                  |         |                             |               |
                                  |         +------------+----------------+               |
                                  |                      |                                |
                                  |                      v                                |
                                  |         CallResponse.Builder()                        |
                                  |         .setDisallowCall(shouldBlock)                 |
                                  |         .setSilenceCall(shouldSilence)                |
                                  |         .setSkipCallLog(false)                        |
                                  |         .build() -> respondToCall(details, response)  |
                                  |                      |                                |
                                  |                      v                                |
                                  |         Capacitor Bridge / Event Sync                 |
                                  +----------------------|--------------------------------+
                                                         |
                                                         v
                                  +-------------------------------------------------------+
                                  |     React + TypeScript Mobile Web UI (Capacitor)      |
                                  |  - Real-time Call Screening Dashboard & Risk Badges   |
                                  |  - Audio Isolation HUD: Caller Uplink vs Local Silence|
                                  |  - Dynamic Contextual Quick-Reply Action Chips        |
                                  |  - STIR/SHAKEN Attestation Badge (Level A/B/Spoofed)  |
                                  |  - Zero-Trust PII Redaction & Threat Radar Breakdown  |
                                  +-------------------------------------------------------+
                                                         |
                                                         v
                                  +-------------------------------------------------------+
                                  |            Node.js Backend & LLM Engine               |
                                  |  - Google Gemini / Cloud LLM Multi-Turn Dialogue      |
                                  |  - Adversarial Prompt Injection & Jailbreak Defense   |
                                  |  - Automated Multi-Tier Scam & Threat Taxonomy        |
                                  |  - Rate Limiter, HMAC Signature & Replay Prevention   |
                                  +-------------------------------------------------------+
```

---

## 🌟 Industry-Grade Features

### 1. Caller-End Audio Routing & Strict Local Isolation ("AI Talks on Caller End, Not Ours")
- **Caller Uplink Exclusivity**: During screening, AI Text-To-Speech audio and automated greetings are routed directly into the cellular voice call uplink (`STREAM_VOICE_CALL` / `MODE_IN_COMMUNICATION`). The caller hears the AI loud and clear.
- **Local Downlink Muting**: Phone loudspeakers and earpieces are strictly silenced on our end during automated screening so the user is never disturbed by bot speech.
- **Microphone Isolation**: Local microphone input is hardware-muted and isolated during AI screening to eliminate room background noise or private conversations from leaking to the remote caller.
- **Private "Listen In" HUD**: Device owners can tap the *Listen In* monitor at any time to hear caller chatter without unmuting the local microphone or broadcasting room audio.

### 2. Multi-Turn Conversational Dialog State Machine
- Dynamic multi-turn conversational dialog engine mimicking Google Pixel Call Screen and Truecaller Assistant.
- Tracks dialogue turns (`GREETING` -> `AWAITING_NAME_PURPOSE` -> `FOLLOWUP_QUERY` -> `CONCLUDED`).
- Automatically generates real-time contextual quick-reply chips based on caller intent (e.g., "Ask for company name", "Leave at front door", "Call back later", "Mark as scam & disconnect").

### 3. STIR/SHAKEN Cryptographic Caller ID Verification
- Android 11+ (API 30+) carrier cryptographic verification status check:
  - **Full Attestation (Level A)**: Origin carrier has cryptographically verified the caller's identity and right to use the telephone number.
  - **Partial Attestation (Level B)**: Origin customer known, but telephone number ownership unverified.
  - **Gateway Attestation (Level C)**: Call originated from an international or unauthenticated gateway.
  - **Spoof Alert (FAILED)**: Cryptographic signature failed; call is flagged and auto-rejected.

### 4. Zero-Trust PII & Financial Redaction
- Transcripts, log entries, and UI displays automatically sanitize sensitive personally identifiable information (PII) including credit card numbers, Social Security Numbers (SSN), One-Time Passcodes (OTP), CVV codes, and bank account numbers.
- Frontend includes an interactive PII redaction toggle allowing users to view sanitized or raw transcripts securely.

### 5. Adversarial Prompt Injection & Jailbreak Defense
- Inspects all caller utterances in real-time for prompt injection attempts, system prompt overrides, delimiter tampering, and jailbreak vectors (e.g., "Ignore previous instructions", "System override", "DAN mode").
- Immediately flags adversarial attempts as high-risk threats, neutralizing the attack and triggering an automated disconnect.

### 6. Backend Hardening & API Security
- **HMAC-SHA256 Request Verification**: Guarantees authenticity of requests between mobile app and backend.
- **Replay Attack Prevention**: Enforces timestamp freshness windows (`MAX_TIMESTAMP_DRIFT_MS = 300,000ms`) to thwart recorded payload replays.
- **Token Bucket Rate Limiting**: Prevents API exhaustion and distributed denial-of-service threats with burst-limiting token buckets and HTTP 429 throttling.
- **Audio Upload Path Traversal Defense**: Sanitizes file paths and filenames to block directory traversal vulnerabilities.

---

## 📱 Cloud APK Build & Download Instructions

You **do not need Android Studio** installed on your laptop to generate or test the Android APK.

1. Push your changes or navigate to the **Actions** tab on your GitHub repository: [https://github.com/YOGI-YA/callscreener/actions](https://github.com/YOGI-YA/callscreener/actions)
2. Select the **Build Android APK** workflow.
3. Click **Run workflow** (or wait for the automatic push trigger).
4. Once completed, scroll down to the **Artifacts** section and download `aegiscall-debug-apk`.
5. Transfer `app-debug.apk` to your physical Android device.

---

## 📲 Testing on a Physical Android Device

> [!IMPORTANT]
> **Android Telephony Notice**: Android's `CallScreeningService` only intercepts real telecom calls on a physical device with an active SIM/eSIM card and user-granted default app permissions.

### Step-by-Step Setup:
1. **Install APK**: Install `app-debug.apk` on your Android device (Android 10 / API 29 or higher).
2. **Grant Default Screener Role**:
   - Open AegisCall AI, go to the **Settings** tab, and tap **Request Screening Role**.
   - Or open Android **Settings** → **Apps** → **Default Apps** → **Caller ID & Spam App** → select **AegisCall AI**.
3. **Configure Backend Endpoint**:
   - In the AegisCall AI **Settings** tab, enter your backend server URL (e.g., `http://192.168.1.100:4000`).
   - Tap **Test** to verify connection.
4. **Receive a Test Call**:
   - Call your device from a secondary number. The native `AiCallScreeningService` intercepts and screens the call according to your rules and AI settings.

---

## 💻 Local Development Quickstart

### Prerequisites
- Node.js 18+ or 20+
- npm 9+

### 1. Clone & Install
```bash
git clone https://github.com/YOGI-YA/callscreener.git
cd callscreener
npm install --prefix backend
npm install --prefix frontend
```

### 2. Environment Configuration
Create `backend/.env` (optional — intelligent mock analyzer runs automatically if no key is provided):
```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-1.5-flash
```

### 3. Run Dev Server
```bash
# Start backend (Port 4000) & frontend (Port 3000) concurrently:
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 🧪 Automated Testing

AegisCall AI features a comprehensive automated test suite covering unit, integration, and security layers:

```bash
# Run all tests across monorepo
npm test

# Run backend test suite (41 tests: prompt injection, rate limiting, replay attack, STIR/SHAKEN, LLM taxonomy)
npm run test --prefix backend

# Run frontend test suite (22 tests: audio isolation HUD, STIR/SHAKEN badges, PII masking, quick replies)
npm run test --prefix frontend
```

---

## 📁 Repository Structure

```
callscreener/
├── .github/
│   └── workflows/
│       ├── android-build.yml     # Cloud Android APK build workflow
│       └── ci.yml                # Monorepo automated test suite
├── backend/
│   ├── src/
│   │   ├── config.ts             # Environment & deadline configuration
│   │   ├── middleware/
│   │   │   ├── rateLimiter.ts        # Token bucket rate limiter & IP throttling
│   │   │   └── securityMiddleware.ts # HMAC signature verification & replay defense
│   │   ├── services/
│   │   │   ├── promptInjectionDefense.ts # Zero-trust prompt injection analyzer
│   │   │   ├── stirShakenService.ts      # STIR/SHAKEN carrier ID verification
│   │   │   ├── fastRulesEngine.ts        # Deterministic local regex & keyword engine (<2ms)
│   │   │   ├── llmScreeningEngine.ts     # Google Gemini AI caller risk analyzer
│   │   │   └── callLogStorage.ts         # History storage & analytics aggregator
│   │   ├── routes/
│   │   │   ├── screeningRoutes.ts    # POST /api/screen-call, GET /api/rules
│   │   │   ├── logRoutes.ts          # GET /api/logs, GET /api/logs/stats
│   │   │   └── healthRoutes.ts       # GET /api/health
│   │   └── tests/                # Automated backend test suite (41 unit tests)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardTab.tsx        # Metrics, spam block rate gauge, recent logs
│   │   │   ├── IncomingCallOverlay.tsx # Audio isolation HUD, live transcript, smart chips
│   │   │   ├── CallModal.tsx           # PII redaction toggle & live threat breakdown
│   │   │   ├── RiskBadge.tsx           # Risk levels & STIR/SHAKEN attestation badges
│   │   │   ├── DialerTab.tsx           # Interactive phone keypad & dialer
│   │   │   └── SettingsTab.tsx         # RoleManager & security configuration
│   │   ├── services/
│   │   │   ├── api.ts                  # REST API client
│   │   │   └── capacitorService.ts     # Native bridge & browser mock fallback
│   │   └── test/                   # Automated frontend test suite (22 unit tests)
├── android/
│   ├── app/src/main/java/com/aegiscall/screener/
│   │   ├── telecom/
│   │   │   ├── AiCallScreeningService.kt   # Android CallScreeningService interceptor
│   │   │   ├── AegisInCallService.kt       # Multi-turn in-call screening service
│   │   │   ├── TelecomAudioRouter.kt       # Caller-end uplink & local silencing router
│   │   │   ├── StirShakenVerifier.kt       # Carrier cryptographic verification engine
│   │   │   ├── SensitiveDataMasker.kt      # PII & financial data sanitizer
│   │   │   ├── ContextualRepliesGenerator.kt # Real-time smart action chips generator
│   │   │   └── FastLocalRulesEngine.kt     # In-memory LRU cache & fast fallback rules
│   │   └── plugins/
│   │       └── CallScreeningPlugin.kt      # Capacitor bridge for telephony & audio events
└── README.md
```

---

## 🛡️ License

MIT License © 2026 AegisCall AI
