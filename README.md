# Chessbook AI — Personal Chess Coach

**Chessbook AI** is a free-first, privacy-respecting, local-first chess analysis and training platform inspired by Chessbook. It turns your own imported games into personalized tactical lessons, builds your opening repertoire, detects opening deviations, tracks recurring tactical weaknesses in a personal memory model, and schedules interactive training exercises using the SuperMemo SM-2 spaced repetition algorithm.

Everything runs **100% locally in your browser** with zero mandatory account registration, zero paywalls, and zero cloud API key requirements.

---

## Key Features

### 1. Genuine Stockfish in a Web Worker
- Genuine Stockfish engine compiled to WebAssembly (WASM) and JS running inside a dedicated browser Web Worker.
- Communicates via the standard UCI (Universal Chess Interface) protocol.
- Adjustable analysis presets:
  - **Quick**: Depth 10
  - **Standard**: Depth 14
  - **Deep**: Depth 18
- Move-by-move evaluations normalized to White-relative centipawns, candidate lines (PV), and forced mate distances.
- Safe cancellation without corrupting engine state.

### 2. Move-by-Move Interactive Analysis
- High-performance chessboard powered by `react-chessboard` and `chess.js`.
- Color-coded move classifications:
  - **Best** (★)
  - **Excellent** (✓)
  - **Good** (•)
  - **Inaccuracy** (?!)
  - **Mistake** (?)
  - **Blunder** (??)
  - **Missed Win** (⚡)
  - **Forced Move** (□)
  - **Book Move** (📖)
- Smooth animated vertical Evaluation Bar with numeric pawns / forced mate distance.
- Interactive evaluation sparkline graph across all plies with click-to-jump.
- Keyboard navigation (Arrow keys, Space for autoplay, 'F' to flip board).

### 3. Grounded Personal Chess Coach
- Rule-based tactical reasoning engine grounded in actual engine lines and board positions:
  - **Hanging Pieces & Loose Pieces (LPDO)**
  - **Unprotected Pieces**
  - **Missed Checkmates & Forcing Checks**
  - **Missed Free Material**
  - **Tactical Forks & Double Attacks**
  - **Back-Rank Vulnerabilities & Luft**
  - **King Safety & Shield Weakening**
  - **Premature Queen Mobilization & Opening Principles**
- Provides beginner-friendly explanations, tactical consequences, opponent's strongest reply, and practical advice.
- Direct shortcut to practice any flagged mistake in the Training Studio.

### 4. Opening Repertoire & Deviation Detection
- Create and manage opening trees for:
  - **White**: Italian Game, Open Games, etc.
  - **Black vs 1.e4**: Sicilian Defense, French, 1...e5, etc.
  - **Black vs 1.d4**: King's Indian, Nimzo-Indian, QGD, etc.
- Import opening lines from PGN.
- Interactive recall practice where you play moves against the repertoire.
- Automatic **Game Deviation Detector**: scans your imported games and flags the exact ply where your move diverged from your prepared repertoire.

### 5. Personal Chess Memory & Weakness Profiler
- Automatically profiles recurring tactical blindspots across your games (e.g. "Hanging Pieces (5x)", "Overlooked Forced Mates (2x)", "Vulnerability to Forks (3x)").
- Stores supporting game examples with direct links to the exact position.
- Assigns actionable training priorities (High, Medium, Low).

### 6. Spaced Repetition Training Studio
- Converts significant game mistakes into interactive flashcards.
- Implements the **SuperMemo SM-2** spaced repetition algorithm:
  - Calculates interval, ease factor, repetition count, and due dates.
  - Positions consistently answered correctly appear less frequently; difficult blunders reappear quickly.
- Interactive chessboard to solve the position with hints, instant verification, and celebration effects.

### 7. Multi-Source Game Import & Deduplication
- **PGN File Upload**: Drag-and-drop single or multi-game archives.
- **Paste PGN**: Paste raw PGN text directly.
- **Lichess Public API**: Fetch games directly via Lichess's public CORS export.
- **Chess.com Public Archives**: Fetch monthly archive games.
- **Instant Demo Master Games**: Test immediately with Kasparov's Immortal or Carlsen vs. Nakamura.
- Robust SHA-based normalized fingerprinting to prevent duplicate game imports.

### 8. Local-First IndexedDB & Data Portability
- Persists all games, analyses, opening trees, and training cards in IndexedDB via Dexie.
- **Backup & Restore**: Export full JSON database backups anytime to migrate between browsers or computers.
- Zero server dependencies.

---

## Technology Stack

- **Framework**: React 18+ with TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS (Deep charcoal theme with emerald accents)
- **Engine**: Stockfish 10 compiled to WebAssembly / JS (`stockfish.js`)
- **Chess Rules**: `chess.js`
- **Board UI**: `react-chessboard`
- **Database**: Dexie.js (IndexedDB v4)
- **State**: Zustand
- **Icons**: Lucide React
- **Testing**: Vitest + Testing Library

---

## Quickstart & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Run Unit Tests
```bash
npm test
```
Runs the Vitest test suite covering:
- PGN parsing & multi-game splitting
- Evaluation sign normalization & mate handling
- Centipawn loss math & move classifications
- Coach rule-based reasoning engine
- Opening repertoire trees & deviation detection
- SM-2 spaced repetition calculations
- Dexie database persistence & JSON backup export/restore

### 4. Build for Production
```bash
npm run build
```

### 5. Preview Production Build
```bash
npm run preview
```
