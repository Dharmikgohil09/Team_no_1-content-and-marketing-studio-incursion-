# Content & Marketing Studio — ACM NIT Surat 🎨

> A full-stack web application designed for the **ACM NIT Surat** student chapter. Effortlessly design, generate, and export print-ready ID cards, name badges, and event credentials from natural-language requests.

---

## ✨ Features

- **🗣️ Natural-Language Event Processing**: Describe your event in plain English (e.g. *"ID cards for our 24-hour hackathon on 18 October at SVNIT with separate looks for participants, organizers, and mentors"*).
- **❓ Intelligent Follow-ups**: Extracts event context (Name, Date, Venue, Duration, Roles) and asks targeted clarification questions only for missing information.
- **🎨 Programmatic Vector Renderer**: Built with pure SVG rendering — crisp, sharp, scalable, and print-ready at any DPI.
- **📐 Print-Ready Standards**: Supports CR80 standard physical dimensions ($85.6 \text{ mm} \times 53.95 \text{ mm}$), $3\text{ mm}$ bleed margins, trim marks, QR code generation, barcode rendering, dynamic name text wrapping, and role-based color coding.
- **⚡ 3 Built-in Templates**:
  1. **ACM Modern Tech Pass**: Futuristic dark-mode layout with dynamic role accent bands and glassmorphism.
  2. **ACM Executive Badge**: Corporate layout with prominent ACM Surat header and structured metadata.
  3. **ACM Minimalist Ticket**: Sleek ticket style with large QR/Barcode and high contrast typography.
- **✏️ Interactive Editor**: Tweak fonts, colors, element positions, role palettes, and shapes with live previews, undo/redo, and version saving.
- **📊 CSV & JSON Bulk Data Import**: Upload participant data, auto-map columns, validate records, and preview cards per person.
- **📥 High-Resolution Exports**: One-click download as multi-page **PDF** (using `pdf-lib`), **PNG** (at 150/300/600 DPI), or vector **SVG**.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Dharmikgohil09/Team_no_1-content-and-marketing-studio-incursion-.git
   cd Team_no_1-content-and-marketing-studio-incursion-
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional for Gemini AI features):
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY in .env if desired
   ```

### Running Locally

Start the Vite development server:
```bash
npm run dev
```
Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

Optionally, start the Express LLM proxy server:
```bash
npm run server
```

### Production Build

```bash
npm run build
```

---

## 🛠️ Built With

- **Frontend**: React 18, React Router v6, TypeScript, Vite, Tailwind CSS
- **State Management**: Zustand, Dexie.js (IndexedDB)
- **PDF & Vector Engines**: `pdf-lib`, HTML5 Canvas rasterizer, inline SVG renderer
- **Barcodes & QR**: `qrcode`, `jsbarcode`
- **Backend Proxy**: Express, `@google/generative-ai` (Gemini Flash API)
- **Data Import**: PapaParse

---

## 📜 License

Created for ACM NIT Surat. All rights reserved.