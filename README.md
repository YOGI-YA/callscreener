# AegisCall AI: AI-Powered Android Call Screener & Spam Defense

[![CI Test Suite](https://github.com/YOGI-YA/callscreener/actions/workflows/ci.yml/badge.svg)](https://github.com/YOGI-YA/callscreener/actions/workflows/ci.yml)
[![Build Android APK](https://github.com/YOGI-YA/callscreener/actions/workflows/android-build.yml/badge.svg)](https://github.com/YOGI-YA/callscreener/actions/workflows/android-build.yml)

AegisCall AI is an intelligent Android call-screening solution that intercepts incoming telephone calls in real-time, analyzes caller intent and fraud probability via Cloud LLMs (Google Gemini), and enforces automated telecom verdicts (`ALLOW`, `SILENCE`, or `REJECT`) within strict Android OS response deadlines.

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
                                  |  |  - onScreenCall(Call.Details)                   |  |
                                  |  |  - Strict Response Deadline (2500ms timeout)     |  |
                                  |  |  - Asynchronous Coroutine Network Dispatch      |  |
                                  |  +-------------------------------------------------+  |
                                  |         |                             |               |
                                  |    (Network OK)                 (Timeout / Error)     |
                                  |         |                             |               |
                                  |         v                             v               |
                                  |   Node.js REST API           Local Kotlin Fallback    |
                                  |   /api/screen-call           Heuristics & Regex       |
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
                                  |  - Interactive Browser Call Simulator & Mock Scenarios|
                                  |  - Call Logs, Transcript Viewer & Whitelist/Blacklist |
                                  |  - RoleManager & Permission Activation Wizard        |
                                  +-------------------------------------------------------+
                                                         |
                                                         v
                                  +-------------------------------------------------------+
                                  |            Node.js Backend & LLM Engine               |
                                  |  - Google Gemini / Cloud LLM Risk Analysis Engine     |
                                  |  - Fast Deterministic Heuristic Engine (<5ms)         |
                                  |  - Log Ingestion, Rule Sync, Health & Latency API     |
                                  +-------------------------------------------------------+
```

---

## 🌟 Key Features

1. **Mobile-First Glassmorphic Interface**:
   - Modern dark theme built with high-precision CSS tokens, animated audio waveforms, and dynamic risk meters.
   - Comprehensive dashboard showing real-time spam block percentage, screened call metrics, and recent threats.
2. **Real-Time Telecom CallScreeningService**:
   - Native Kotlin service implementing `android.telecom.CallScreeningService`.
   - Respects Android's strict ~5-second response deadline via a 2.5-second coroutine timeout budget.
   - Built-in `FastLocalRulesEngine` ensures instant (<1ms) fallback if the network is disconnected.
3. **Cloud LLM AI Screening Engine**:
   - Evaluates caller ID, area code patterns, spoof likelihood, and spoken voice transcripts against Google Gemini / Cloud LLM models.
   - Generates actionable verdicts: `ALLOW` (legitimate/contacts), `SILENCE` (suspicious/debt collectors), `REJECT` (phishing/robocall fraud).
4. **Interactive Browser Call Simulator**:
   - Test realistic scam scenarios without needing active phone calls:
     - 🚨 *IRS Arrest Warrant Phishing Scam*
     - 🚗 *Auto Warranty Robocall Bot*
     - 📦 *Amazon Delivery Courier at Gate*
     - 🏥 *Stanford Health Clinic Doctor Appointment*
     - 💳 *Bank OTP Harvesting Fraud*
     - ✍️ *Custom Dynamic Caller Simulator*
5. **Fast Local Screening Rules**:
   - Whitelist trusted contacts and emergency services (911, 112, 988) unconditionally.
   - Block malicious toll-fraud prefixes (`+1-900`, `+1-976`, satellite fraud numbers) instantly.
6. **Cloud Android Build (No Local Android Studio Required)**:
   - Automated GitHub Actions workflow builds signed/debug `.apk` packages in the cloud.
7. **Security**:
   - All AI API keys and secrets stay securely on the Node.js backend.

---

## 📱 Cloud APK Build & Download Instructions

You **do not need Android Studio** installed on your laptop to generate or test the Android APK.

1. Push your changes or navigate to the **Actions** tab on your GitHub repository: [https://github.com/YOGI-YA/callscreener/actions](https://github.com/YOGI-YA/callscreener/actions)
2. Select the **Build Android APK** workflow.
3. Click **Run workflow** (or wait for the automatic push trigger).
4. Once completed, scroll down to the **Artifacts** section and download `aegiscall-debug-apk`.
5. Unzip and transfer `app-debug.apk` to your physical Android device.

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
   - Ensure your phone and computer are on the same Wi-Fi network.
   - In the AegisCall AI **Settings** tab, enter your computer's local IP address (e.g., `http://192.168.1.100:4000`).
   - Tap **Test** to verify connection.
4. **Receive a Test Call**:
   - Have a secondary phone call your device. The native `AiCallScreeningService` will evaluate the caller in real-time and silence/block/allow based on the AI verdict.

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

### 2. Environment Configuration (Optional)
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

Run the full test suite across both backend and frontend:

```bash
# Run all tests
npm test

# Run backend unit & integration tests
npm run test --prefix backend

# Run frontend React component tests
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
│   │   ├── services/
│   │   │   ├── fastRulesEngine.ts    # Deterministic local regex & keyword engine (<2ms)
│   │   │   ├── llmScreeningEngine.ts # Google Gemini AI caller risk analyzer
│   │   │   └── callLogStorage.ts     # History storage & analytics aggregator
│   │   ├── routes/
│   │   │   ├── screeningRoutes.ts    # POST /api/screen-call, GET /api/rules
│   │   │   ├── logRoutes.ts          # GET /api/logs, GET /api/logs/stats
│   │   │   └── healthRoutes.ts       # GET /api/health
│   │   ├── server.ts
│   │   ├── index.ts
│   │   └── tests/                # Automated backend test suite
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardTab.tsx      # Metrics, spam block rate gauge, recent logs
│   │   │   ├── SimulatorTab.tsx      # Interactive incoming call simulator
│   │   │   ├── CallLogsTab.tsx       # Filterable & searchable call history
│   │   │   ├── RulesTab.tsx          # Fast local screening rules manager
│   │   │   ├── SettingsTab.tsx       # Android RoleManager & backend URL config
│   │   │   ├── IncomingCallOverlay.tsx # Audio wave & real-time AI transcript
│   │   │   ├── CallModal.tsx         # Detailed rationale inspection
│   │   │   └── Navbar.tsx            # Bottom mobile navigation
│   │   ├── services/
│   │   │   ├── api.ts                # REST API client
│   │   │   └── capacitorService.ts   # Native bridge & browser mock fallback
│   │   ├── index.css                 # Glassmorphic mobile-first design system
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml   # BIND_SCREENING_SERVICE & Telecom registration
│   │   │   └── java/com/aegiscall/screener/
│   │   │       ├── MainActivity.kt
│   │   │       ├── plugins/CallScreeningPlugin.kt # RoleManager bridge
│   │   │       ├── telecom/AiCallScreeningService.kt # Kotlin CallScreeningService
│   │   │       └── telecom/FastLocalRulesEngine.kt  # Fast local fallback
│   │   └── build.gradle
│   ├── build.gradle
│   └── settings.gradle
├── capacitor.config.ts
├── package.json
└── README.md
```

---

## 🛡️ License

MIT License © 2026 AegisCall AI
