# EventCanvas 🎨

> **Intelligent, Print-Ready Event Credential & ID Card Studio**  
> Transform natural-language event descriptions into pixel-perfect, role-color-coded ID cards, badges, and credentials with bulk data ingestion, automated photo matching, and print-ready PDF export.

---

## ✨ Features

- **🗣️ Natural-Language Event Processing**: Simply describe your event in plain English (e.g., *"Garba night on 18 October at SVNIT for 10 participants with separate looks for participants and organizers"*).
- **🤖 Dual-Mode AI & Deterministic Engine**: Powered by Google Gemini Flash for semantic event analysis and interactive design refinement, with a seamless deterministic fallback when offline or without an API key.
- **🎨 True Vector Card Renderer**: Pure SVG-based rendering adhering to international CR80 card standards ($85.6 \text{ mm} \times 53.98 \text{ mm}$), $3\text{ mm}$ bleed margins, trim marks, dynamic text wrapping, and role accent bands.
- **✏️ Interactive Real-Time Editor**: Live editor with instant preview for typography, color tokens, layout geometry, QR codes, and Code128 barcodes.
- **✨ AI Design Refinement**: Tweak and micro-adjust generated designs using conversational natural-language instructions (e.g., *"Make header bolder"*, *"Shift avatar right"*, *"Switch to festive warm colors"*).
- **📊 CSV & JSON Bulk Ingestion**: Upload participant spreadsheets, auto-map columns (ID, Name, Role, Team, Photo), and automatically limit participant import to the quota specified in the event description.
- **📸 Smart Bulk Photo Matching**: Upload ZIP archives or image folders; matches photos automatically via direct ID, filename stems, or fuzzy name similarity (Levenshtein & Token Dice) with interactive manual override support.
- **📥 High-Resolution Print Exports**: One-click download as multi-page print-ready **PDF** (via `pdf-lib` with crop marks and bleed), high-res **PNG** (150/300 DPI), or raw vector **SVG** archives.
- **🛡️ Local-First Storage Architecture**: Uses Dexie.js (IndexedDB) for high-resolution images to prevent browser LocalStorage quota exceptions.

---

## 🚀 Step-by-Step Project Setup

Follow these instructions to set up and run EventCanvas on your local machine.

### 1. Prerequisites

Ensure you have the following installed:
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: v9.0.0 or higher (comes bundled with Node.js)
- **Git**: Installed and configured ([Download Git](https://git-scm.com/))

Verify your environment by running:
```bash
node -v
npm -v
git --version
```

---

### 2. Clone the Repository

Clone the project from GitHub and navigate into the project directory:

```bash
git clone https://github.com/Dharmikgohil09/Team_no_1-content-and-marketing-studio-incursion-.git
cd Team_no_1-content-and-marketing-studio-incursion-
```

---

### 3. Install Dependencies

Install all frontend and backend dependencies:

```bash
npm install
```

---

### 4. Configure Environment Variables

Create your local `.env` file by copying the provided example:

```bash
# On Linux / macOS / Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

Open `.env` in your text editor and configure the parameters:

```env
# Google Gemini API Key for AI features (optional — deterministic fallback works without key)
GEMINI_API_KEY=your_gemini_api_key_here

# Express Backend Port
PORT=3001

# Supabase Cloud Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
# Optional: Service Role Key for privileged backend checks (never expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
DATABASE_URL="postgresql://postgres:your_password@db.your-project-id.supabase.co:5432/postgres"

# Auth & OTP Configuration (Optional overrides with sensible defaults)
VITE_OTP_LENGTH=6
VITE_OTP_RESEND_COOLDOWN_SECONDS=60
VITE_OTP_MAX_ATTEMPTS=5
VITE_AUTH_REDIRECT_PATH=/studio/describe
```

> **Note**: An API key is **not strictly required** to run the app. If `GEMINI_API_KEY` is omitted, the studio automatically runs in **deterministic mode**, using local heuristic extraction and templates.

---

### 5. Supabase Database Migration & Dashboard Setup

To enable email OTP authentication and profile synchronization:

#### A. Run SQL Migration
1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Open [`supabase/migrations/20261019_create_profiles.sql`](file:///c:/Users/DHARMIK/OneDrive/Desktop/Team_no_1(incursion)/Team_no_1-content-and-marketing-studio-incursion-/supabase/migrations/20261019_create_profiles.sql) (or copy its contents).
3. Paste into the SQL editor and click **Run**. This creates the `profiles` table, enables Row Level Security (RLS), and sets up the automated `on_auth_user_created` trigger.

#### B. Configure Supabase Dashboard Settings
1. **Enable Email Provider**:
   - Go to **Authentication** -> **Providers** -> **Email**.
   - Ensure **Enable Email provider** is turned **ON**.
   - Make sure **Confirm email** is enabled (or toggle according to your sign-in preferences).
2. **Configure OTP Code in Email Templates**:
   - Go to **Authentication** -> **Email Templates**.
   - In both **Magic Link** and **Confirm signup** templates, add `{{ .Token }}` so the email delivers a 6-digit verification code:
     ```html
     <h2>Your Verification Code</h2>
     <p>Your one-time login code is: <strong>{{ .Token }}</strong></p>
     <p>This code expires shortly. Do not share it with anyone.</p>
     ```
3. **Configure Custom SMTP (Recommended for Production)**:
   - Go to **Project Settings** -> **Authentication** -> **SMTP Settings**.
   - Toggle **Enable Custom SMTP** and enter your provider credentials (e.g. Resend, SendGrid, Amazon SES) to avoid default rate limits on OTP delivery.

---

### 6. Running the Application Locally

For full functionality (including LLM endpoints and proxying), run both the **Backend** and **Frontend** servers.

#### Option A: Running Both Backend & Frontend (Recommended)

Open two terminal windows in the project directory:

**Terminal 1 — Backend Express Server:**
```bash
npm run server
```
*The backend starts at [http://localhost:3001](http://localhost:3001).*

**Terminal 2 — Frontend Vite Dev Server:**
```bash
npm run dev
```
*The frontend starts at [http://localhost:5173](http://localhost:5173).*

#### Option B: Frontend-Only Mode (Offline / Deterministic)

If you only want to use the offline heuristic engine:
```bash
npm run dev
```

---

### 7. Verify the Setup

1. Open your browser and navigate to **[http://localhost:5173](http://localhost:5173)**.
2. Verify the backend health status by opening **[http://localhost:3001/api/health](http://localhost:3001/api/health)** (should return `{"status":"ok", ...}`).
3. Navigate to **[http://localhost:5173/studio/describe](http://localhost:5173/studio/describe)** (will prompt to sign in or register if unauthenticated).

---

## 🧪 Testing & Validation

### Run Automated Unit & Integration Tests
The repository includes a comprehensive test suite (100 tests) covering authentication schemas, vector rendering, AI intent resolution, fuzzy photo matching, and CSV slicing:

```bash
npm test
```

### TypeScript Compilation Check
Verify type safety without emitting build files:

```bash
npx tsc --noEmit
```

### Production Build
Create an optimized production bundle in the `dist/` directory:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 📁 Project Directory Structure

```text
├── index.html                   # Entry HTML document & Google Fonts config
├── package.json                 # Project dependencies & scripts
├── vite.config.ts               # Vite configuration & backend proxy rules
├── tailwind.config.ts           # Design tokens, fonts, and theme extensions
├── server/
│   ├── index.ts                 # Express API server (Gemini proxy, health checks)
│   └── supabase.ts              # Supabase server client
├── src/
│   ├── main.tsx                 # React application entry point
│   ├── App.tsx                  # App routing & providers
│   ├── index.css                # Global CSS variables & editorial typography
│   ├── brandKits/               # Brand kits & institutional logo configurations
│   ├── core/
│   │   ├── ai/                  # Intent extraction, draft generation, micro-adjust engine
│   │   ├── export/              # PDF (pdf-lib), PNG canvas rasterizer, SVG export
│   │   ├── matching/            # Fuzzy photo matcher, ZIP/folder archive extractor
│   │   ├── renderers/           # SVG CR80 vector card renderer
│   │   └── schema/              # Zod schemas (DesignProject, Person, Role, CardTemplate)
│   ├── store/
│   │   ├── projectStore.ts      # Zustand project state & IndexedDB sync
│   │   └── db.ts                # Dexie.js IndexedDB schema (photos & projects)
│   ├── ui/
│   │   ├── WizardLayout.tsx     # 6-step progress header & navigation shell
│   │   └── pages/
│   │       ├── HomePage.tsx     # Landing page
│   │       ├── DescribePage.tsx # Step 1: Prompt & natural language input
│   │       ├── ClarifyPage.tsx  # Step 2: Interactive event metadata review
│   │       ├── DraftsPage.tsx   # Step 3: Design drafts & AI refinement
│   │       ├── EditorPage.tsx   # Step 4: Interactive visual card editor
│   │       ├── DataPage.tsx     # Step 5: CSV mapping & bulk photo matcher
│   │       └── ExportPage.tsx   # Step 6: Multi-format download center
│   └── utils/
│       └── participantCount.ts  # NLP participant count parsing & CSV slicer
└── src/tests/                   # Vitest unit & integration test suites
```

---

## 🛠️ Built With

- **Frontend Core**: React 18, React Router v6, TypeScript, Vite 5.4
- **Styling & Design System**: Tailwind CSS, Vanilla CSS Variables, Google Fonts (Hanken Grotesk, Instrument Serif, JetBrains Mono)
- **State & Local-First Database**: Zustand, Dexie.js (IndexedDB)
- **Document & Vector Engines**: `pdf-lib`, `jspdf`, `svg2pdf.js`, `qrcode`, `jsbarcode`
- **Data & File Handlers**: PapaParse (CSV), JSZip (ZIP archives), Zod (Runtime validation)
- **AI & Backend Server**: Express, `@google/generative-ai` (Gemini Flash), `@supabase/supabase-js`
- **Testing**: Vitest, Playwright

---

## 📜 License

Open source under the [MIT License](LICENSE).