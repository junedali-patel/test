# CodeMind.AI — Project Progress

Last updated: 2026-10-12

---

## Completed Tasks

### Flowchart — Compact & Meaningful Generation
- **Grouped consecutive PROCESS nodes** — a 50-line file now produces ~10–20 nodes in Standard mode instead of 50+.
- **Three detail levels** — Overview (≤15 nodes), Standard (default, 10–40 nodes), Detailed (up to 80).
- **Human-readable labels** — every node has a title ("Check passing marks") AND the raw code as a subtitle (`marks >= 40`).
- **`POST /api/flowchart/analyze/selection`** — new endpoint that returns a focused sub-tree for the selected code range, with AST cache to avoid re-parsing on every click.
- **`detail` param** added to the existing `/api/flowchart/analyze` endpoint (backward-compatible, defaults to `"standard"`).
- Commits: `32dc5b9` (server), `3abfc69` (client), `70522cd` (lint/type fixes).

### Flowchart — Auto-Update on Editor Click
- **CodeEditor** now passes `selectedText` as a 3rd arg to `onSelectionChange`.
- **FlowchartPanel** debounces cursor changes (400ms) and auto-fetches a new focused flowchart — no manual "Generate" button needed.
- **page.tsx** captures `selectedCode` and passes `editorSelection` to IDELayout and FlowchartPanel.
- `SelectionAnalysisParams` interface added to `client/types/flowchart.ts`.
- `analyzeSelection()` function added to `client/services/flowchartApi.ts`.

### Lint & Type Cleanup
- 28 lint/type issues fixed across 14 client files.
- All `catch (err: any)` changed to `catch (err: unknown)` with proper type narrowing.
- `npx next build` exits 0 with zero TypeScript/ESLint errors.

### AI Voice Explanation (Part 1 + Part 2 — COMPLETE)

#### Server
- **`POST /api/ai/explain`** upgraded in `server/routes/ai.js` to support:
  - Bilingual explanations: English (simple, clear) and Hindi (Devanagari script).
  - Rich request body: `code`, `language`, `filePath`, `startLine`, `endLine`, `explainLanguage`, `nodeType`, `nodeLabel`, `context`.
  - Reuses existing `generateWithFallback()` (Ollama → Groq fallback chain).
  - Language-aware system prompts — preserves code identifiers in both languages.
  - Always returns HTTP 200: `source: "ai"` when AI succeeds, `source: "fallback"` when AI is unavailable.
  - Metadata-based fallback explanation so the client always gets a useful response.

#### Client Foundation
- **`client/types/voice.ts`** — `PlaybackStatus`, `ExplainLanguage`, `EditorSelection` types.
- **`client/services/explainApi.ts`** — `explainCode()` POSTs to `/api/ai/explain`, `catch (err: unknown)` throughout.
- **`client/hooks/useSpeechSynthesis.ts`** — reusable React hook:
  - Loads voices on mount + `voiceschanged` event + polling retries.
  - `speak`, `pause`, `resume`, `cancel`, `replay` — all wired to real `window.speechSynthesis`.
  - Cancels on unmount. Prevents duplicate sessions (cancel before each new speak).

#### Client UI
- **`client/components/voice/VoiceExplanation.tsx`** — full component:
  - English / हिन्दी language toggle.
  - "Explain Selected Code" button (disabled when no context).
  - All 5 playback controls work with real SpeechSynthesis: Listen, Pause, Resume, Replay, Stop.
  - Language→voice filtering: English prefers `en-IN` → `en-US` → any `en-*`; Hindi prefers `hi-IN` → any `hi-*`.
  - Clear warning when no matching voice is available (never silently uses wrong language).
  - Speech-rate slider (0.5–2.0×).
  - Voice selector dropdown filtered by language.
  - Playback status badge: idle / generating / ready / speaking / paused / stopped / error.
  - Loading and error states.
  - Rapid-selection cancel: switching code while speaking stops old speech.
  - Unmount cancel: speech stops when navigating away.
  - Unsupported browser message.

#### IDE Integration
- **`client/components/layout/IDELayout.tsx`** — "AI Voice Explanation" and "Agentic Tutor" sub-tabs added inside the AI Assistant panel. `VoiceExplanation` rendered in the Voice tab; `AIChatView` unchanged in the Tutor tab.
- **`client/app/repo/[owner]/[repo]/page.tsx`** — `selectedCode` state captured and `editorSelection` passed to IDELayout.
- All existing features preserved: File Flow, Function Flow, Project Flow, Mind Map, Node Details, Agentic Tutor, GitHub auth, repository loading.

---

## Pending Tasks

- **Audio sentence synchronization** — Chrome SpeechSynthesis does not provide reliable word/sentence timing, so highlighted-node-follows-speech is not implemented. Documented limitation.
- **Long utterance Chrome bug** — Chrome pauses SpeechSynthesis after ~15 seconds on long explanations. No browser workaround without a third-party TTS API. Documented limitation.
- **Node-to-source navigation arrow** — clicking a flowchart node navigates the editor, but a visual "Go to source" button inside VoiceExplanation's detail panel is not yet added (the NodeDetailPanel already has this).
- **More language adapters** — C, C++, C#, Go, Rust, PHP, Ruby, Kotlin, Swift AST adapters not yet implemented.
- **Expand/collapse nodes in large graphs** — placeholder logic exists but interactive drill-down within the React Flow canvas is not fully implemented.
- **Project Flow relationships** — currently shows file-level nodes; actual import/call dependency edges need further work.

---

## Important Files

### Server
| File | Purpose |
|------|---------|
| `server/index.js` | Express app, route mounting |
| `server/routes/ai.js` | AI endpoints: `/explain`, `/chat`, `/complete`, `/analyze-repo` |
| `server/routes/flowchart.js` | Flowchart endpoints: `/analyze`, `/analyze/selection` |
| `server/analyzer/analyzerService.js` | Orchestrates AST parsing + flow generation |
| `server/analyzer/flow/flowGenerator.js` | Generates flow nodes/edges with detail levels |
| `server/analyzer/flow/flowNode.js` | Node creation + `generateLabel()` heuristics |
| `server/analyzer/ast/javaAdapter.js` | Java AST → IR |
| `server/analyzer/ast/javascriptAdapter.js` | JS/JSX AST → IR |
| `server/analyzer/ast/typescriptAdapter.js` | TS/TSX AST → IR |
| `server/analyzer/ast/pythonAdapter.js` | Python AST → IR |

### Client — Types & Services
| File | Purpose |
|------|---------|
| `client/types/flowchart.ts` | FlowNode, FlowEdge, SelectionAnalysisParams |
| `client/types/voice.ts` | PlaybackStatus, ExplainLanguage, EditorSelection |
| `client/services/flowchartApi.ts` | `analyzeFile()`, `analyzeSelection()` |
| `client/services/explainApi.ts` | `explainCode()` — AI explanation API |
| `client/hooks/useSpeechSynthesis.ts` | Browser TTS hook |

### Client — Components
| File | Purpose |
|------|---------|
| `client/components/voice/VoiceExplanation.tsx` | AI Voice Explanation panel (Part 1+2) |
| `client/components/layout/IDELayout.tsx` | Main IDE layout, AI panel sub-tabs |
| `client/components/flowchart/FlowchartPanel.tsx` | Flowchart panel with auto-selection |
| `client/components/flowchart/FlowchartCanvas.tsx` | React Flow canvas |
| `client/components/flowchart/FlowNode.tsx` | Node rendering (title + subtitle) |
| `client/components/flowchart/NodeDetailPanel.tsx` | Node detail side panel |
| `client/components/CodeEditor.tsx` | Monaco editor with selection callback |
| `client/app/repo/[owner]/[repo]/page.tsx` | Main repo page, wires everything together |

---

## Next Steps

1. **Run the app and test end-to-end:**
   ```bash
   # Terminal 1 — start the server
   cd server && npm start

   # Terminal 2 — start the client
   cd client && npm run dev
   ```
   Open http://localhost:3000, sign in with GitHub, open a repository, select a file, click code — the flowchart should auto-update. Open the AI Assistant panel (robot icon in activity bar), click "AI Voice Explanation", click "Explain Selected Code".

2. **Test Hindi voice** — requires a Hindi (hi-IN) voice installed in your OS or browser. On Windows: Settings → Time & Language → Speech → Add voices → Hindi (India).

3. **Test flowchart compactness** — open a Java or Python file with 40+ lines. Should produce ~15–25 nodes in Standard mode.

4. **Add C/C++ adapters** — the next language to add. Install `tree-sitter-c` and `tree-sitter-cpp`, create `server/analyzer/ast/cAdapter.js` following the pattern in `javaAdapter.js`.

5. **Improve Project Flow** — add actual import/require resolution to show real file dependency edges, not just file nodes.

---

## How to Start

```bash
# Server (port 4000)
cd server
npm install
npm start

# Client (port 3000)
cd client
npm install
npm run dev
```

**Requirements:**
- Node.js 18+
- Ollama running locally (`ollama serve`) with at least one model (e.g. `codegemma:2b`) for AI explanations. Without Ollama, explanations still work via the Groq fallback (requires `GROQ_API_KEY` in `server/.env`) or a metadata fallback.
- GitHub token in localStorage (`github_token`) for repository loading.
- For Hindi TTS: a Hindi (hi-IN) voice installed in your OS/browser.
