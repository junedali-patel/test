'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Code2, ArrowRight, Sparkles, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [patToken, setPatToken] = useState('');
  const [isVerifyingPat, setIsVerifyingPat] = useState(false);
  const [error, setError] = useState('');
  const [showPatInput, setShowPatInput] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const token = localStorage.getItem('github_token');
    if (token) {
      router.push('/');
    }
  }, [router]);

  const handleGitHubLogin = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      console.log('[Login] Requesting GitHub OAuth URL from backend...');
      const response = await fetch(`${API_BASE_URL}/api/github/auth/github-url`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Backend returned status ${response.status}`);
      }

      if (!data.url) {
        throw new Error('No OAuth URL returned from backend');
      }

      console.log('[Login] Redirecting to GitHub OAuth...');
      window.location.href = data.url;
    } catch (error: unknown) {
      console.error('[Login Error]', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to initiate GitHub login. Please verify server/.env configuration or use a Personal Access Token / Demo Mode below.'
      );
      setIsSigningIn(false);
    }
  };

  const handlePatLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patToken.trim()) return;

    setIsVerifyingPat(true);
    setError('');

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${patToken.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        throw new Error('Invalid GitHub token or insufficient permissions.');
      }

      localStorage.setItem('github_token', patToken.trim());
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify token');
    } finally {
      setIsVerifyingPat(false);
    }
  };

  const handleDemoLaunch = () => {
    // Set a lightweight mock token for demo exploration
    localStorage.setItem('github_token', 'demo_offline_mode');
    router.push('/repo/codemind/core');
  };

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col justify-between font-sans selection:bg-[#264f78]">
      {/* Top VS Code Style Window Header */}
      <header className="h-[35px] bg-[#323233] border-b border-[#2b2b2b] px-4 flex items-center justify-between text-xs text-[#cccccc] select-none shrink-0">
        <div className="flex items-center gap-2 font-medium">
          <Code2 size={15} className="text-[#007acc]" />
          <span className="text-[#e0e0e0] font-semibold">Visual Studio CodeMind</span>
          <span className="text-[#858585] text-[11px]">— Sign In</span>
        </div>
        <div className="text-[11px] text-[#858585]">
          Ready
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-[440px] w-full">
          {/* Main Card */}
          <div className="bg-[#252526] border border-[#3c3c3c] rounded p-6 shadow-xl">
            {/* Visual Studio Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#3c3c3c]">
              <div className="w-10 h-10 rounded bg-[#007acc] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Code2 size={22} />
              </div>
              <div>
                <h1 className="text-base font-semibold text-[#ffffff] leading-tight">
                  Sign in to CodeMind
                </h1>
                <p className="text-xs text-[#858585] mt-0.5">
                  Select an authentication method to access workspaces
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-[#5a1d1d]/30 border border-[#f14c4c]/40 rounded text-xs text-[#f14c4c] flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <div className="font-semibold mb-0.5">Authentication Notice</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            {/* Primary Action: GitHub OAuth */}
            <div className="space-y-3">
              <button
                onClick={handleGitHubLogin}
                disabled={isSigningIn}
                className="w-full h-[36px] bg-[#0e639c] hover:bg-[#1177bb] active:bg-[#0d598a] disabled:opacity-50 text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Github size={16} />
                <span>{isSigningIn ? 'Connecting to GitHub...' : 'Continue with GitHub OAuth'}</span>
                <ArrowRight size={14} className="ml-auto" />
              </button>

              {/* Direct Demo / Workspace Launch */}
              <button
                onClick={handleDemoLaunch}
                className="w-full h-[36px] bg-[#2d2d2d] hover:bg-[#383838] border border-[#3c3c3c] text-[#cccccc] hover:text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Sparkles size={15} className="text-[#75beff]" />
                <span>Launch Demo Workspace (Instant Access)</span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#3c3c3c]" />
              <span className="text-[11px] uppercase tracking-wider text-[#858585]">Or</span>
              <div className="flex-1 h-px bg-[#3c3c3c]" />
            </div>

            {/* Personal Access Token Option */}
            {!showPatInput ? (
              <button
                onClick={() => setShowPatInput(true)}
                className="w-full text-left p-2.5 rounded bg-[#1e1e1e] hover:bg-[#2a2d2e] border border-[#3c3c3c] flex items-center justify-between text-xs text-[#cccccc] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Key size={14} className="text-[#007acc]" />
                  <span>Use Personal Access Token (PAT)</span>
                </div>
                <span className="text-[11px] text-[#858585]">Configure →</span>
              </button>
            ) : (
              <form onSubmit={handlePatLogin} className="space-y-2.5">
                <label className="block text-xs font-medium text-[#cccccc]">
                  GitHub Personal Access Token:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={patToken}
                    onChange={(e) => setPatToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full h-[32px] bg-[#1e1e1e] border border-[#3c3c3c] focus:border-[#007acc] rounded px-3 text-xs text-white placeholder-[#6e7681] outline-none font-mono"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPatInput(false)}
                    className="px-3 h-[28px] bg-[#2d2d2d] hover:bg-[#383838] border border-[#3c3c3c] text-[#cccccc] rounded text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingPat || !patToken.trim()}
                    className="px-4 h-[28px] bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                  >
                    {isVerifyingPat ? 'Verifying...' : 'Sign In with Token'}
                  </button>
                </div>
              </form>
            )}

            {/* Footer Notes */}
            <div className="mt-5 pt-4 border-t border-[#3c3c3c] text-[11px] text-[#858585] flex items-center justify-between">
              <span>VS Code Dark+ Environment</span>
              <Link href="/signup" className="text-[#3794ff] hover:underline">
                New user? Register
              </Link>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="mt-3 p-3 bg-[#252526]/70 border border-[#3c3c3c]/60 rounded text-[11px] text-[#858585] space-y-1">
            <div className="flex items-center gap-1.5 text-[#cccccc]">
              <CheckCircle2 size={13} className="text-[#73c991]" />
              <span className="font-medium">Direct workspace support</span>
            </div>
            <div>
              Click <strong className="text-[#cccccc]">Launch Demo Workspace</strong> to jump straight into the full Monaco IDE, Flowchart visualizer, and Copilot tools without needing credentials.
            </div>
          </div>
        </div>
      </main>

      {/* VS Code Blue Status Bar */}
      <footer className="h-[22px] bg-[#007acc] text-white px-3 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>CodeMind v1.0.0</span>
          <span>● Online</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>TypeScript</span>
        </div>
      </footer>
    </div>
  );
}
