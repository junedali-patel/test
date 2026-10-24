'use client';

// client/components/voice/VoiceExplanation.tsx
// AI Voice Explanation panel. Generates an English/Hindi explanation of the
// currently selected flowchart node (or editor selection) via POST /api/ai/explain,
// then reads it aloud using the browser SpeechSynthesis API through the
// useSpeechSynthesis hook. All five playback controls (Play/Listen, Pause,
// Resume, Replay, Stop) drive real speechSynthesis calls.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Repeat,
  Loader2,
  AlertCircle,
  Languages,
  Mic,
  ChevronDown
} from 'lucide-react';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { explainCode, type ExplainParams } from '@/services/explainApi';
import { FlowNode } from '@/types/flowchart';
import { PlaybackStatus, EditorSelection, ExplainLanguage } from '@/types/voice';

interface VoiceExplanationProps {
  selectedNode?: FlowNode | null;
  editorSelection?: EditorSelection | null;
  currentFile?: string | null;
  code?: string | null;
  language?: string | null;
}

/** Slice an inclusive 1-based line range out of a code string. */
function sliceCodeFromLines(
  code: string | null | undefined,
  lineStart?: number,
  lineEnd?: number
): string {
  if (!code || !lineStart) return '';
  const lines = code.split('\n');
  const startIdx = Math.max(0, lineStart - 1);
  const endLine = lineEnd || lineStart;
  const endIdx = Math.min(lines.length, endLine);
  if (startIdx >= endIdx) return '';
  return lines.slice(startIdx, endIdx).join('\n');
}

const STATUS_LABEL: Record<PlaybackStatus, string> = {
  idle: 'Idle',
  generating: 'Generating…',
  ready: 'Ready',
  speaking: 'Speaking…',
  paused: 'Paused',
  stopped: 'Stopped',
  error: 'Error'
};

const STATUS_COLOR: Record<PlaybackStatus, string> = {
  idle: 'bg-[#252526] text-[#858585] border border-[#3c3c3c]',
  generating: 'bg-[#0e639c]/20 text-[#75beff] border border-[#0e639c]/40',
  ready: 'bg-[#73c991]/20 text-[#73c991] border border-[#73c991]/40',
  speaking: 'bg-[#0e639c]/20 text-[#75beff] border border-[#0e639c]/40',
  paused: 'bg-[#cca700]/20 text-[#cca700] border border-[#cca700]/40',
  stopped: 'bg-[#252526] text-[#858585] border border-[#3c3c3c]',
  error: 'bg-[#5a1d1d]/40 text-[#f14c4c] border border-[#f14c4c]/40'
};

export default function VoiceExplanation({
  selectedNode = null,
  editorSelection = null,
  currentFile = null,
  code = null,
  language = null
}: VoiceExplanationProps) {
  const {
    supported,
    voices,
    speaking,
    paused,
    speak,
    pause,
    resume,
    cancel,
    replay
  } = useSpeechSynthesis();

  const [explainLanguage, setExplainLanguage] = useState<ExplainLanguage>('en');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [showPlaybackSettings, setShowPlaybackSettings] = useState(false);

  // Distinguishes a natural speech end from a user-initiated Stop so the
  // reconcile effect never overrides an explicit action.
  const wasSpeakingRef = useRef(false);
  // Latest playback status for the rapid-selection effect (avoids stale closure).
  const statusRef = useRef<PlaybackStatus>('idle');
  useEffect(() => {
    statusRef.current = playbackStatus;
  }, [playbackStatus]);
  // Token to ignore stale explain responses after the context/language changed.
  const explainReqIdRef = useRef(0);

  // ---- Voice management: filter by language + auto-select best match ----
  useEffect(() => {
    const prefix = explainLanguage === 'en' ? 'en' : 'hi';
    const norm = (l: string) => l.toLowerCase().replace('_', '-');
    const filtered = voices.filter((v) => norm(v.lang).startsWith(prefix));
    setAvailableVoices(filtered);
    if (filtered.length === 0) {
      setSelectedVoiceURI(null);
      return;
    }
    const preferred = explainLanguage === 'en' ? ['en-in', 'en-us'] : ['hi-in'];
    const best =
      filtered.find((v) => preferred.includes(norm(v.lang))) ?? filtered[0];
    setSelectedVoiceURI(best.voiceURI);
  }, [voices, explainLanguage]);

  const matchingVoiceExists = availableVoices.length > 0;

  // ---- Context collection: prefer selected flowchart node, else editor selection, else full file ----
  const context = useMemo<ExplainParams | null>(() => {
    if (selectedNode) {
      return {
        code: sliceCodeFromLines(code, selectedNode.lineStart, selectedNode.lineEnd),
        language: language ?? undefined,
        filePath: selectedNode.file || currentFile || '',
        startLine: selectedNode.lineStart,
        endLine: selectedNode.lineEnd,
        explainLanguage,
        nodeType: selectedNode.type,
        nodeLabel: selectedNode.label
      };
    }
    if (editorSelection && editorSelection.text) {
      return {
        code: editorSelection.text,
        language: language ?? undefined,
        filePath: currentFile || '',
        startLine: editorSelection.lineStart,
        endLine: editorSelection.lineEnd,
        explainLanguage
      };
    }
    // Fix 1A: fall back to full file when a file is open
    if (code?.trim()) {
      return {
        code: code.trim(),
        language: language ?? undefined,
        filePath: currentFile || '',
        startLine: 1,
        endLine: undefined,
        explainLanguage
      };
    }
    return null;
  }, [selectedNode, editorSelection, code, language, currentFile, explainLanguage]);

  const hasContext = context !== null;

  // Signature of what is currently being explained, for rapid-change invalidation.
  const contextSignature = `${selectedNode?.id ?? ''}|${editorSelection?.text ?? ''}|${
    editorSelection?.lineStart ?? ''
  }|${editorSelection?.lineEnd ?? ''}`;
  const prevSigRef = useRef<string | null>(null);

  // ---- Rapid selection / new-code cancel: stop stale playback ----
  useEffect(() => {
    if (prevSigRef.current === null) {
      prevSigRef.current = contextSignature;
      return; // skip first run
    }
    if (prevSigRef.current !== contextSignature) {
      prevSigRef.current = contextSignature;
      const st = statusRef.current;
      if (st === 'speaking' || st === 'paused') {
        cancel();
      }
      // Invalidate any in-flight explain request and abandon its loading state.
      explainReqIdRef.current += 1;
      wasSpeakingRef.current = false;
      setExplanation('');
      setError(null);
      setIsLoading(false);
      setPlaybackStatus('idle');
    }
  }, [contextSignature, cancel]);

  // ---- Language change: the old-language explanation is no longer valid ----
  useEffect(() => {
    cancel();
    wasSpeakingRef.current = false;
    explainReqIdRef.current += 1;
    setExplanation('');
    setError(null);
    setIsLoading(false);
    setPlaybackStatus('idle');
  }, [explainLanguage, cancel]);

  // ---- Reconcile playback status from hook.speaking / hook.paused ----
  useEffect(() => {
    if (isLoading) return; // do not override while generating
    if (speaking && !paused) {
      wasSpeakingRef.current = true;
      setPlaybackStatus('speaking');
    } else if (speaking && paused) {
      setPlaybackStatus('paused');
    } else if (!speaking && !paused && wasSpeakingRef.current) {
      wasSpeakingRef.current = false;
      setPlaybackStatus('stopped');
    }
  }, [speaking, paused, isLoading]);

  // ---- Explain handler (POST /api/ai/explain) ----
  const handleExplain = async () => {
    if (!context) return;
    const reqId = (explainReqIdRef.current += 1);
    setIsLoading(true);
    setError(null);
    setPlaybackStatus('generating');
    cancel(); // stop any in-flight speech before generating
    wasSpeakingRef.current = false;
    try {
      const res = await explainCode(context);
      if (reqId !== explainReqIdRef.current) return; // stale
      setExplanation(res.explanation);
      setPlaybackStatus('ready');
    } catch (e: unknown) {
      if (reqId !== explainReqIdRef.current) return; // stale
      setError(e instanceof Error ? e.message : 'Unable to generate explanation.');
      setPlaybackStatus('error');
    } finally {
      if (reqId === explainReqIdRef.current) setIsLoading(false);
    }
  };

  // ---- Playback handlers (real speechSynthesis via the hook) ----
  const handlePlay = () => {
    if (!explanation) return;
    // Fix 1C: voices not yet loaded — wait for voiceschanged then retry
    if (voices.length === 0) {
      const retry = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', retry);
        handlePlay();
      };
      window.speechSynthesis.addEventListener('voiceschanged', retry);
      return;
    }
    if (!matchingVoiceExists) return;
    wasSpeakingRef.current = false;
    setPlaybackStatus('speaking');
    speak(explanation, selectedVoiceURI ?? undefined, speechRate);
  };
  const handlePause = () => {
    pause();
    setPlaybackStatus('paused');
  };
  const handleResume = () => {
    resume();
    setPlaybackStatus('speaking');
  };
  const handleReplay = () => {
    if (!explanation || !matchingVoiceExists) return;
    wasSpeakingRef.current = false;
    setPlaybackStatus('speaking');
    replay(explanation, selectedVoiceURI ?? undefined, speechRate);
  };
  const handleStop = () => {
    wasSpeakingRef.current = false;
    cancel();
    setPlaybackStatus('stopped');
  };

  // Disabled state for each control (source of truth = hook.speaking / hook.paused).
  const playDisabled =
    !supported || !explanation || !matchingVoiceExists || speaking || isLoading;
  const pauseDisabled = !supported || !(speaking && !paused);
  const resumeDisabled = !supported || !paused;
  const replayDisabled =
    !supported || !explanation || !matchingVoiceExists || isLoading;
  const stopDisabled = !supported || (!speaking && !paused);

  const noVoiceWarning =
    !supported
      ? null
      : voices.length === 0
      ? 'Loading voices…'
      : !matchingVoiceExists
      ? (explainLanguage === 'hi'
          ? 'No Hindi voice available on this device. Install a Hindi (hi-IN) voice in your OS/browser speech settings to hear Hindi playback. You can still read the explanation below.'
          : 'No English voice available on this device. Install an English (en-US or en-IN) voice in your OS/browser speech settings to hear English playback. You can still read the explanation below.')
      : null;

  const btnBase =
    'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const btnPrimary = `${btnBase} bg-[#0e639c] hover:bg-[#1177bb] border-[#0e639c] text-white`;
  const btnSecondary = `${btnBase} bg-[#2d2d2d] hover:bg-[#383838] border-[#3c3c3c] text-[#cccccc] hover:text-white px-2.5`;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] text-xs overflow-hidden">

      {/* Status badge + language toggle on same row */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-[#252526] border-b border-[#2b2b2b]">
        {/* Language toggle */}
        <div className="flex bg-[#1e1e1e] border border-[#3c3c3c] rounded p-0.5">
          <button
            type="button"
            onClick={() => setExplainLanguage('en')}
            aria-pressed={explainLanguage === 'en'}
            aria-label="Explain in English"
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              explainLanguage === 'en'
                ? 'bg-[#0e639c] text-white'
                : 'text-[#858585] hover:text-white hover:bg-[#2a2d2e]'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setExplainLanguage('hi')}
            aria-pressed={explainLanguage === 'hi'}
            aria-label="Explain in Hindi"
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              explainLanguage === 'hi'
                ? 'bg-[#0e639c] text-white'
                : 'text-[#858585] hover:text-white hover:bg-[#2a2d2e]'
            }`}
          >
            हिन्दी
          </button>
        </div>

        {/* Status badge */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono ${STATUS_COLOR[playbackStatus]}`}
        >
          {speaking && !paused ? (
            <span className="flex items-center gap-1">
              <Mic size={9} className="animate-pulse" />
              {STATUS_LABEL[playbackStatus]}
            </span>
          ) : (
            STATUS_LABEL[playbackStatus]
          )}
        </span>
      </div>

      {/* Unsupported browser warning */}
      {!supported && (
        <div className="mx-3 mt-2 flex items-start gap-2 p-2 rounded bg-[#5a1d1d]/40 border border-[#f14c4c]/40 text-[#f14c4c] shrink-0">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Your browser does not support speech synthesis.
          </span>
        </div>
      )}

      {/* Explain button — full width */}
      <div className="p-3 shrink-0">
        <button
          type="button"
          onClick={handleExplain}
          disabled={!hasContext || isLoading}
          className="w-full h-[32px] flex items-center justify-center gap-2 px-3 rounded text-xs font-medium transition-colors bg-[#0e639c] hover:bg-[#1177bb] border border-[#0e639c] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Languages size={13} />
          )}
          <span>{isLoading ? 'Generating Audio Walkthrough…' : 'Generate Voice Walkthrough'}</span>
        </button>
      </div>

      {/* Fix 1B: Empty state — file open but no selection (full-file fallback active) */}
      {!selectedNode && !editorSelection?.text && !!code?.trim() && !isLoading && (
        <div className="mx-3 mt-2 mb-1 flex items-start gap-2 p-2.5 rounded bg-[#1f6feb]/10 border border-[#1f6feb]/30 text-[#58a6ff] shrink-0">
          <span className="text-[11px]">Explaining full file. Select specific code for a focused explanation.</span>
        </div>
      )}

      {/* Fix 1B: Empty state — no file at all */}
      {!hasContext && !code?.trim() && !isLoading && (
        <p className="px-3 py-2 text-[#8b949e] shrink-0">Open a file to get started.</p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="px-3 py-2 flex items-center gap-2 text-[#58a6ff] shrink-0">
          <Loader2 size={13} className="animate-spin" />
          <span>Generating explanation…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mt-1 flex items-start gap-2 p-2.5 rounded bg-[#da3633]/10 border border-[#da3633]/40 text-[#f85149] shrink-0">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Explanation (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 ide-scrollbar">
        {explanation ? (
          <div className="whitespace-pre-wrap break-words text-[#cccccc] leading-relaxed p-3 rounded bg-[#252526] border border-[#3c3c3c] text-xs font-mono">
            {explanation}
          </div>
        ) : null}
      </div>

      {/* No matching voice warning */}
      {noVoiceWarning && (
        <div className="mx-3 mb-2 flex items-start gap-2 p-2 rounded bg-[#cca700]/15 border border-[#cca700]/40 text-[#cca700] shrink-0">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="break-words text-xs">{noVoiceWarning}</span>
        </div>
      )}

      {/* Playback Settings */}
      {supported && (
        <div className="px-3 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPlaybackSettings(prev => !prev)}
            className="flex items-center gap-1 text-[11px] font-medium text-[#858585] hover:text-white transition-colors w-full py-1 cursor-pointer"
            aria-expanded={showPlaybackSettings}
          >
            <ChevronDown size={11} className={`transition-transform ${showPlaybackSettings ? '' : '-rotate-90'}`} />
            <span>Playback Engine Settings</span>
          </button>
          {showPlaybackSettings && (
            <div className="mt-1 p-2 rounded bg-[#252526] border border-[#3c3c3c] space-y-2">
              {/* Voice selector */}
              <div>
                <label className="flex items-center gap-2 mb-1 text-[#858585]">
                  <Mic size={12} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Synthesis Voice</span>
                </label>
                <select
                  value={selectedVoiceURI ?? ''}
                  onChange={(e) => setSelectedVoiceURI(e.target.value || null)}
                  disabled={!matchingVoiceExists}
                  aria-label="Playback voice"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] text-[#cccccc] text-xs rounded px-2 py-1 focus:outline-none focus:border-[#007acc] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed slider */}
              <div>
                <label className="flex items-center justify-between mb-1 text-[#858585]">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Speech Rate</span>
                  <span className="text-xs font-mono text-[#007acc]">{speechRate.toFixed(1)}x</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  aria-label="Playback speed"
                  className="w-full accent-[#007acc]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fix 1D: Playback buttons — icon-only except Listen */}
      <div className="flex items-center gap-1.5 px-3 pb-3 pt-1 shrink-0">
        <button
          type="button"
          onClick={handlePlay}
          disabled={playDisabled}
          aria-label="Play explanation aloud"
          title="Listen"
          className={btnPrimary}
        >
          <Play size={12} />
          Listen
        </button>
        <button
          type="button"
          onClick={handlePause}
          disabled={pauseDisabled}
          aria-label="Pause playback"
          title="Pause"
          className={btnSecondary}
        >
          <Pause size={13} />
        </button>
        <button
          type="button"
          onClick={handleResume}
          disabled={resumeDisabled}
          aria-label="Resume playback"
          title="Resume"
          className={btnSecondary}
        >
          <RotateCcw size={13} />
        </button>
        <button
          type="button"
          onClick={handleReplay}
          disabled={replayDisabled}
          aria-label="Replay explanation from the beginning"
          title="Replay"
          className={btnSecondary}
        >
          <Repeat size={13} />
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={stopDisabled}
          aria-label="Stop playback"
          title="Stop"
          className={btnSecondary}
        >
          <Square size={13} />
        </button>
      </div>
    </div>
  );
}
