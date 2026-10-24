# Implementation Plan — CodeMind.AI Flowchart Fix

## Architecture Decisions

**Decision 1 — grouping in flowGenerator.js, not in adapters.**
The adapters (javaAdapter, javascriptAdapter, etc.) are correct to emit one IR node per statement — that's their job. Grouping is a rendering concern. Adding a `detail` pass in flowGenerator.js is the right layer because it is language-agnostic and doesn't require touching four adapter files. Rationale: changing adapters would risk breaking the IR contract for future features.

**Decision 2 — selection endpoint on the server, not client-side filtering.**
The client already filters nodes post-fetch by type (overview/standard). That approach still returns 50+ nodes over the wire and the client just hides them, which doesn't make the flowchart meaningful. A real selection endpoint parses only the relevant IR sub-tree, so the graph is inherently small. Rationale: "Fix the graph generation, do not solve this merely by shrinking font or zooming out."

**Decision 3 — 400ms debounce on cursorLine in FlowchartPanel, not CodeEditor.**
CodeEditor already fires onCursorChange on every keystroke. Debouncing at the consumer (FlowchartPanel) keeps CodeEditor's behavior unchanged and avoids introducing a second timer in the parent page. Rationale: minimal change, lowest coupling.

**Decision 4 — cache at the route layer with a module-level Map (not a separate cache module).**
There is no Redis/persistent cache in this project. A module-level `Map` keyed by `filePath:djb2(code)` is the simplest approach that survives the request lifecycle without adding dependencies. Rationale: no new npm packages needed.

---

## Server Changes

- [ ] 1. **flowNode.js — add `code` field and `generateLabel` helper**

  Update `createFlowNode` to accept an optional `code` parameter (default `''`), stored on the returned node object as `code`. Add an exported `generateLabel(type, rawCode)` function with the following label rules (applied in order):
  - `FUNCTION_DEF`: `'Function: {name}'` — extract name via `/^(\w+)\s*\(/`
  - `FUNCTION_CALL` / `function_call`: `'Call: {name}'` — same extraction
  - `RETURN`: `'Return {value}'` where value is rawCode minus `'return '` prefix
  - `INPUT`: `'Read Input'`
  - `OUTPUT`: `'Print Output'`
  - `DECISION`: `'Check: {cond}'` where cond is rawCode truncated to 40 chars, trailing `?` stripped
  - `LOOP`: `'Loop: {cond}'` — rawCode truncated to 40 chars
  - Assignment with `total|sum|count|result|avg|score` in varName (regex `/(total|sum|count|result|avg|score)/i.test(rawCode)`): `'Calculate {varName}'`
  - Assignment (contains `=` but not `==`, `!=`, `<=`, `>=`): `'Set {varName}'` where varName is left side of `=`
  - Fallback: first 50 chars of rawCode

  Keep all existing exports intact. File: `server/analyzer/flow/flowNode.js`.

  **Verify:** `node -e "const {generateLabel,createFlowNode}=require('./server/analyzer/flow/flowNode'); console.log(generateLabel('DECISION','marks >= 40')); console.log(createFlowNode({type:'process',label:'x=1',code:'x=1',file:'f.js'}).code)"` — prints `'Check: marks >= 40'` and `'x=1'`.

---

- [ ] 2. **flowGenerator.js — add `detail` param and PROCESS grouping**

  Add `detail = 'standard'` parameter to `generateFlowchartFromIR`. Pass it through to all recursive `translateSequence` calls.

  **Add `countIRNodes(ir)` helper** (recursive) at top of file: counts total nodes a sequence would produce (needed to detect >80 node collapse):
  ```js
  function countIRNodes(ir = []) {
    let n = ir.length;
    for (const item of ir) {
      if (item.body) n += countIRNodes(item.body);
      if (item.trueBranch) n += countIRNodes(item.trueBranch);
      if (item.falseBranch) n += countIRNodes(item.falseBranch);
    }
    return n;
  }
  ```

  **In `translateSequence`, replace the `IR_TYPES.PROCESS` case** with this logic:

  ```
  case IR_TYPES.PROCESS: {
    if (detail === 'overview') break; // skip entirely in overview

    if (detail === 'standard') {
      // Collect consecutive PROCESS items starting at idx
      const run = [item];
      while (idx + run.length < sequence.length &&
             sequence[idx + run.length]?.type === IR_TYPES.PROCESS) {
        run.push(sequence[idx + run.length]);
      }
      if (run.length >= 2) {
        // Emit one merged node; advance idx by run.length - 1 (loop will +1)
        const label = `Statements (${run.length})`;
        const code = run[0].label;
        const procNode = createFlowNode({ type:'process', label, code, file:fileName,
          lineStart: run[0].lineStart, lineEnd: run[run.length-1].lineEnd });
        nodes.push(procNode);
        currentIncoming.forEach(inc => edges.push(createFlowEdge({source:inc.id, target:procNode.id, label:inc.label||null})));
        currentIncoming = [{ id: procNode.id }];
        idx += run.length - 1; // compensate (loop does idx++)
        break;
      }
      // Single PROCESS — fall through to emit normally with generateLabel
    }
    // detailed or single PROCESS in standard
    const procNode = createFlowNode({
      type: 'process',
      label: generateLabel('process', item.label),
      code: item.label,
      file: fileName,
      lineStart: item.lineStart,
      lineEnd: item.lineEnd
    });
    nodes.push(procNode);
    currentIncoming.forEach(inc => edges.push(createFlowEdge({source:inc.id, target:procNode.id, label:inc.label||null})));
    currentIncoming = [{ id: procNode.id }];
    break;
  }
  ```

  **In overview mode, also skip** INPUT, OUTPUT, FUNCTION_CALL, BREAK, CONTINUE — add `if (detail === 'overview') break;` at the top of each of those cases.

  **In FUNCTION_DEF case**: after the funcDefNode is created, before recursing into `item.body`:
  - If `nodes.length + countIRNodes(item.body) > 80`, emit the funcDefNode with label `'Function: {item.name}(...)'` but do NOT recurse into the body. Just emit `currentIncoming = [{ id: funcDefNode.id }]` and break.
  - If in overview mode: emit funcDefNode only, do not recurse into body.
  - Otherwise (standard/detailed): recurse as before.

  **Use `generateLabel`** in all other cases (DECISION, LOOP, RETURN, INPUT, OUTPUT, FUNCTION_CALL, THROW) to compute the `label` field, storing the raw source in `code`.

  Import `generateLabel` at the top: `const { createFlowNode, resetNodeCounter, generateLabel } = require('./flowNode');`

  File: `server/analyzer/flow/flowGenerator.js`.

  **Verify:** `node -e "const {generateFlowchartFromIR}=require('./server/analyzer/flow/flowGenerator'); const {parseToIR}=require('./server/analyzer/parserManager'); const {irNodes,functions}=parseToIR('let a=1;\nlet b=2;\nlet c=3;\nif(a>b){console.log(a);}else{console.log(b);}','javascript'); const r=generateFlowchartFromIR({irNodes,fileName:'t.js',functions,detail:'standard'}); console.log(r.nodes.length)"` — must print ≤8 (3 vars → 1 grouped PROCESS + START + decision + 2 output + END).

---

- [ ] 3. **analyzerService.js — thread `detail` through**

  In `analyzeCodeFlowchart`, add `detail = 'standard'` to the destructured options parameter. Pass it to `generateFlowchartFromIR`:
  ```js
  const { nodes, edges } = generateFlowchartFromIR({
    irNodes,
    fileName,
    functionName,
    functions,
    detail      // add this line
  });
  ```
  File: `server/analyzer/analyzerService.js`.

  **Verify:** `node -e "const {analyzeCodeFlowchart}=require('./server/analyzer/analyzerService'); const r=analyzeCodeFlowchart({code:'let x=1; let y=2; let z=3;',language:'javascript',fileName:'t.js',detail:'standard'}); console.log(r.nodes.length)"` — must print ≤4 (START + grouped PROCESS + END).

---

- [ ] 4. **routes/flowchart.js — add `detail` to existing route + new `/analyze/selection` route**

  **Part A**: In the existing `POST /analyze` handler, extract `detail` from `req.body`:
  ```js
  const { code, language: langHint, fileName = 'file', functionName = null, detail = 'standard' } = req.body;
  ```
  Pass `detail` to `analyzeCodeFlowchart`:
  ```js
  const result = analyzeCodeFlowchart({ code, language: detectedLang, fileName, functionName, detail });
  ```

  **Part B**: Add `djb2(str)` hash function at the top of the file:
  ```js
  function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // convert to 32-bit int
    }
    return hash >>> 0; // unsigned
  }
  ```

  **Part B**: Add module-level parse cache above the router:
  ```js
  const parseCache = new Map();
  ```

  **Part B**: Add `findSelectionContext(irNodes, startLine, endLine)` function. This walks the IR tree recursively:
  ```js
  function findSelectionContext(irNodes, startLine, endLine) {
    for (const item of irNodes) {
      // If cursor is inside a function body
      if (item.type === 'function_def' &&
          item.lineStart <= startLine && item.lineEnd >= endLine) {
        // Try to find something more specific inside
        const inner = findSelectionContext(item.body || [], startLine, endLine);
        return inner || item.body || [item];
      }
      // If cursor is on a decision or loop
      if ((item.type === 'decision' || item.type === 'loop') &&
          item.lineStart <= startLine && item.lineEnd >= endLine) {
        return [item];
      }
    }
    // Fallback: find irNodes within ±5 lines of startLine
    const nearby = irNodes.filter(n =>
      n.lineStart !== undefined &&
      Math.abs(n.lineStart - startLine) <= 5
    );
    return nearby.length > 0 ? nearby : irNodes;
  }
  ```

  **Part B**: Add the new route BEFORE `module.exports = router`:
  ```js
  router.post('/analyze/selection', async (req, res) => {
    const {
      code,
      language: langHint,
      startLine = 1,
      endLine = 1,
      detail = 'standard',
      filePath = 'file'
    } = req.body;

    if (typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid request: "code" must be a string.' });
    }

    try {
      const detectedLang = langHint ? langHint.toLowerCase() : detectLanguage(filePath, code);
      if (!isLanguageSupported(detectedLang)) {
        return res.status(422).json({ success: false, error: 'Unsupported language', nodes: [], edges: [] });
      }

      // Cache lookup
      const cacheKey = `${filePath}:${djb2(code)}`;
      let parsed = parseCache.get(cacheKey);
      if (!parsed) {
        parsed = parseToIR(code, detectedLang);
        parseCache.set(cacheKey, parsed);
        // Evict if cache grows large
        if (parseCache.size > 50) {
          const firstKey = parseCache.keys().next().value;
          parseCache.delete(firstKey);
        }
      }

      const { irNodes, functions } = parsed;
      const subIR = findSelectionContext(irNodes, startLine, endLine);

      const { generateFlowchartFromIR } = require('../analyzer/flow/flowGenerator');
      const { nodes, edges } = generateFlowchartFromIR({
        irNodes: subIR,
        fileName: filePath,
        functions,
        detail
      });

      const normalizedNodes = normalizeNodes(nodes);
      const normalizedEdges = normalizeEdges(edges);

      return res.json({
        success: true,
        fileName: filePath,
        language: detectedLang,
        nodes: normalizedNodes,
        edges: normalizedEdges,
        metadata: {
          nodeCount: normalizedNodes.length,
          edgeCount: normalizedEdges.length,
          parserEngine: parsed.parserEngine || 'ast-adapter'
        }
      });
    } catch (error) {
      console.error('[Selection API Error]:', error);
      return res.status(500).json({ success: false, error: 'Unable to parse selection', details: error.message, nodes: [], edges: [] });
    }
  });
  ```

  Add the following require at the top of the file (after the existing requires):
  ```js
  const { parseToIR } = require('../analyzer/parserManager');
  ```

  File: `server/routes/flowchart.js`.

  **Part C**: In `server/index.js`, add `'POST /api/flowchart/analyze/selection'` to the `availableEndpoints` array in the 404 handler. This is a documentation-only change.

  **Verify:** `node -e "require('./server/index.js')"` — no crash. Then: `curl -s -X POST http://localhost:4000/api/flowchart/analyze/selection -H 'Content-Type: application/json' -d '{\"code\":\"if(x>0){console.log(x);}else{console.log(0);}\",\"language\":\"javascript\",\"startLine\":1,\"endLine\":1}' | node -e "process.stdin|>{d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).nodes.length))}"` — must be ≤6.

---

## Client Changes

- [ ] 5. **types/flowchart.ts — add SelectionAnalysisParams**

  Append to the end of the file:
  ```typescript
  export interface SelectionAnalysisParams {
    code: string;
    language: string;
    startLine: number;
    endLine: number;
    detail?: string;
    filePath?: string;
  }
  ```
  File: `client/types/flowchart.ts`.

  **Verify:** included in the next build step (step 9).

---

- [ ] 6. **flowchartApi.ts — add analyzeSelection**

  Add import of `SelectionAnalysisParams` to the existing import from `@/types/flowchart`.

  Append the new function at the end of the file:
  ```typescript
  /**
   * Request selection-aware flowchart from the backend.
   * POST /api/flowchart/analyze/selection
   */
  export async function analyzeSelection(params: SelectionAnalysisParams): Promise<FlowchartResponse> {
    const { code, language, startLine, endLine, detail = 'standard', filePath } = params;

    try {
      const response = await axios.post<FlowchartResponse>(
        `${API_BASE_URL}/api/flowchart/analyze/selection`,
        { code, language, startLine, endLine, detail, filePath: filePath || null },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      if (response.data && response.data.success) {
        return response.data;
      }
      throw new Error(response.data?.error || 'Invalid response from selection analysis backend');
    } catch (err: any) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.details ||
        (err.code === 'ERR_NETWORK'
          ? 'Cannot reach backend server at ' + API_BASE_URL + '. Is server running on port 4000?'
          : err.message || 'Unable to analyze selection.');
      throw new Error(message);
    }
  }
  ```
  File: `client/services/flowchartApi.ts`.

  **Verify:** included in the next build step (step 9).

---

- [ ] 7. **FlowchartPanel.tsx — selection-mode state and auto-update**

  This is the largest client change. Make these modifications:

  **Imports**: Add `analyzeSelection` to the import from `@/services/flowchartApi`.

  **Interface** — add to `FlowchartPanelProps`:
  ```typescript
  cursorEndLine?: number | null;
  ```

  **Destructuring** — add `cursorEndLine = null` to the function parameter destructuring.

  **New state** — add after the existing `isLoading` state declarations:
  ```typescript
  const [selectionFlowData, setSelectionFlowData] = useState<FlowchartResponse | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSelectionLoading, setIsSelectionLoading] = useState(false);
  const selectionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  ```

  **File-change reset effect** — add a NEW useEffect after the existing code/fileName effect:
  ```typescript
  // Reset selection mode whenever the loaded file changes
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectionFlowData(null);
  }, [code, fileName]);
  ```

  **Selection fetch effect** — add a NEW useEffect:
  ```typescript
  useEffect(() => {
    if (cursorLine === null || !code || !language || !fileName) return;
    if (viewMode === 'project') return;

    // Skip blank lines
    const lines = code.split('\n');
    const lineContent = lines[cursorLine - 1];
    if (lineContent === undefined || lineContent.trim() === '') return;

    // Debounce
    if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current);
    selectionDebounceRef.current = setTimeout(async () => {
      setIsSelectionLoading(true);
      try {
        const response = await analyzeSelection({
          code,
          language,
          startLine: cursorLine - 1,
          endLine: (cursorEndLine ?? cursorLine) - 1,
          detail: detailLevel,
          filePath: fileName
        });
        if (response.nodes.length > 0) {
          setSelectionFlowData(response);
          setIsSelectionMode(true);
        }
      } catch {
        // Silently fall back to file graph — do not show error
      } finally {
        setIsSelectionLoading(false);
      }
    }, 400);

    return () => {
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current);
    };
  }, [cursorLine, cursorEndLine, code, fileName, language, detailLevel, viewMode]);
  ```

  **`currentControlFlowLayout` useMemo** — replace the line that reads `if (!fileGraphData?.nodes)` (the first line of the useMemo) with logic that picks the active data source:
  ```typescript
  const activeGraphData = (isSelectionMode && selectionFlowData) ? selectionFlowData : fileGraphData;
  ```
  Then replace all occurrences of `fileGraphData?.nodes` and `fileGraphData?.edges` inside the useMemo with `activeGraphData?.nodes` and `activeGraphData?.edges`.

  **Selection badge + loading spinner** — In the JSX, inside the `currentControlFlowLayout.nodes.length > 0` branch, the existing JSX starts with `<div className="relative w-full h-full">`. Add two children inside that div, BEFORE the `<FlowchartCanvas>` element:

  ```tsx
  {/* Selection mode badge */}
  {isSelectionMode && (
    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-[#1f6feb]/20 border border-[#1f6feb]/40 text-[#58a6ff] text-[10px] font-semibold px-2 py-0.5 rounded-full">
      <span>Selection Mode</span>
      <button
        onClick={() => { setIsSelectionMode(false); setSelectionFlowData(null); }}
        className="hover:text-white transition-colors"
        aria-label="Exit selection mode"
      >
        ×
      </button>
    </div>
  )}
  {/* Selection loading indicator (small spinner, non-blocking) */}
  {isSelectionLoading && (
    <div className="absolute top-2 right-2 z-20">
      <Loader2 size={14} className="text-[#58a6ff] animate-spin" />
    </div>
  )}
  ```

  Ensure `Loader2` is already imported from `lucide-react` — it is, confirmed from reading the file.

  File: `client/components/flowchart/FlowchartPanel.tsx`.

  **Verify:** included in the next build step (step 9).

---

- [ ] 8. **CodeEditor.tsx + page.tsx — multi-line selection range**

  **CodeEditor.tsx**: Add optional `onSelectionChange?: (startLine: number, endLine: number) => void` to the `Props` type. In `handleEditorDidMount`, after the existing `editor.onDidChangeCursorPosition` listener, add:
  ```typescript
  editor.onDidChangeCursorSelection((e: any) => {
    const sel = e.selection;
    if (sel && onSelectionChange) {
      onSelectionChange(sel.startLineNumber, sel.endLineNumber);
    }
  });
  ```
  File: `client/components/CodeEditor.tsx`.

  **page.tsx**: 
  - Add `const [cursorEndLine, setCursorEndLine] = useState<number | null>(null);` alongside the existing `cursorLine` state.
  - In the `<CodeEditor>` JSX, add the prop: `onSelectionChange={(start, end) => { setCursorLine(start); setCursorEndLine(end); }}`
  - In the `<FlowchartPanel>` JSX, add the prop: `cursorEndLine={cursorEndLine}`
  - Inside the `fetchFileContent` callback, after `setSelectedFile(file)`, add: `setCursorEndLine(null);`
  
  File: `client/app/repo/[owner]/[repo]/page.tsx`.

  **Verify:** included in the next build step (step 9).

---

- [ ] 9. **Build verification**

  Run `cd c:\Users\Aditi\codemind_mega\client && npx next build`.

  Expected: exits with code 0 and no TypeScript errors. If TS errors appear, fix them before finishing this step — common issues:
  - `selectionFlowData` passed as `activeGraphData` but `filterCounts` useMemo still reads `fileGraphData` — replace those references too.
  - Missing import of `X` from `lucide-react` for the badge dismiss button — use `×` (HTML entity) in JSX text instead or import `X` from lucide-react (it is already used elsewhere in the file via `RefreshCw`, so check existing imports first).

  Also run `cd c:\Users\Aditi\codemind_mega\server && node -e "require('./index.js')"` and confirm no crash (Ctrl-C after startup banner prints).

  **Verify:** both commands succeed with no errors.

---

## Summary of Files Changed

| File | Change type |
|------|------------|
| `server/analyzer/flow/flowNode.js` | Add `code` field + `generateLabel` export |
| `server/analyzer/flow/flowGenerator.js` | Add `detail` param, PROCESS grouping, overview mode |
| `server/analyzer/analyzerService.js` | Thread `detail` param through |
| `server/routes/flowchart.js` | Add `detail` to existing route + new `/analyze/selection` route |
| `server/index.js` | Add new endpoint to availableEndpoints list |
| `client/types/flowchart.ts` | Add `SelectionAnalysisParams` interface |
| `client/services/flowchartApi.ts` | Add `analyzeSelection` function |
| `client/components/flowchart/FlowchartPanel.tsx` | Selection state, debounced fetch, badge, spinner |
| `client/components/CodeEditor.tsx` | Add `onSelectionChange` prop |
| `client/app/repo/[owner]/[repo]/page.tsx` | Wire `cursorEndLine` state and props |
