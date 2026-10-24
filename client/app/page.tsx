'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Brain, Loader2, Search, Star, GitFork, Code2, LogOut, AlertCircle, BookOpen } from 'lucide-react';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  updated_at: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Vue: '#41b883',
  Dart: '#00B4AB',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function HomePage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [hasCallbackToken, setHasCallbackToken] = useState(false);
  const [userLogin, setUserLogin] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get('token');
    if (callbackToken) {
      setHasCallbackToken(true);
      localStorage.setItem('github_token', callbackToken);
      setIsAuthenticated(true);
      window.history.replaceState({}, document.title, '/');
      fetchUserRepos(callbackToken);
      return;
    }
    const token = localStorage.getItem('github_token');
    if (token) {
      setIsAuthenticated(true);
      fetchUserRepos(token);
    } else {
      router.push('/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserRepos = async (token: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('github_token');
          setIsAuthenticated(false);
          setError('Session expired. Please sign in again.');
          return;
        }
        throw new Error('Failed to fetch repositories');
      }
      const data: Repository[] = await response.json();
      setRepos(data);
      if (data.length > 0) setUserLogin(data[0].owner.login);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
      localStorage.removeItem('github_token');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepoSelect = (owner: string, repo: string) => {
    router.push(`/repo/${owner}/${repo}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('github_token');
    setIsAuthenticated(false);
    setRepos([]);
    router.push('/login');
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Loading / unauthenticated screens ──────────────────────────────────
  if (!isAuthenticated || hasCallbackToken) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 40, height: 40, color: '#2f81f7', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#7d8590', fontSize: 14 }}>
            {hasCallbackToken ? 'Authenticating…' : 'Redirecting…'}
          </p>
        </div>
      </div>
    );
  }

  // ── Main authenticated view ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', overflowY: 'auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── Top navigation bar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#161b22', borderBottom: '1px solid #30363d',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#2f81f7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#e6edf3', letterSpacing: '-0.3px' }}>CodeMind.AI</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/repo/codemind/core')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7957FF] to-[#3478FF] hover:from-[#8A6CFF] hover:to-[#4586FF] text-white text-xs font-semibold shadow-[0_0_12px_rgba(121,87,255,0.4)] transition-all"
          >
            <Code2 size={13} />
            <span>Launch IDE</span>
          </button>
          {userLogin && (
            <span style={{ fontSize: 13, color: '#8b949e' }}>@{userLogin}</span>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6,
              background: 'transparent', border: '1px solid #30363d',
              color: '#8b949e', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f85149'; (e.currentTarget as HTMLButtonElement).style.color = '#f85149'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#30363d'; (e.currentTarget as HTMLButtonElement).style.color = '#8b949e'; }}
          >
            <LogOut style={{ width: 13, height: 13 }} />
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Page body ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* ── Page heading ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', margin: 0 }}>Your Repositories</h1>
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 4 }}>
            Select a repository to open it in the CodeMind.AI editor
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8, marginBottom: 20,
            background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)',
            color: '#f85149', fontSize: 13,
          }}>
            <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* ── Search bar ── */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#8b949e', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Find a repository…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              background: '#0d1117', border: '1px solid #30363d',
              borderRadius: 6, color: '#e6edf3', fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#2f81f7')}
            onBlur={e => (e.currentTarget.style.borderColor = '#30363d')}
          />
        </div>

        {/* ── Repo count ── */}
        {!isLoading && filteredRepos.length > 0 && (
          <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>
            {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        )}

        {/* ── Loading state ── */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
            <Loader2 style={{ width: 32, height: 32, color: '#2f81f7', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#8b949e', fontSize: 13 }}>Loading your repositories…</p>
          </div>
        ) : filteredRepos.length > 0 ? (
          /* ── Repository list ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredRepos.map((repo) => {
              const langColor = repo.language ? (LANG_COLORS[repo.language] ?? '#8b949e') : null;
              return (
                <button
                  key={repo.id}
                  onClick={() => handleRepoSelect(repo.owner.login, repo.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', width: '100%', textAlign: 'left',
                    background: '#161b22', border: '1px solid #21262d',
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s',
                    marginBottom: 6,
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = '#1c2128';
                    b.style.borderColor = '#388bfd';
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = '#161b22';
                    b.style.borderColor = '#21262d';
                  }}
                >
                  {/* Icon */}
                  <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {repo.private
                      ? <BookOpen style={{ width: 16, height: 16, color: '#8b949e' }} />
                      : <Github style={{ width: 16, height: 16, color: '#8b949e' }} />
                    }
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#2f81f7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.name}
                      </span>
                      {repo.private && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid #30363d', color: '#8b949e', flexShrink: 0 }}>
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p style={{ fontSize: 12, color: '#8b949e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.description}
                      </p>
                    )}

                    {/* Meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
                      {repo.language && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: langColor ?? '#8b949e', flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ fontSize: 11, color: '#8b949e' }}>{repo.language}</span>
                        </div>
                      )}
                      {repo.stargazers_count > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Star style={{ width: 11, height: 11, color: '#8b949e' }} />
                          <span style={{ fontSize: 11, color: '#8b949e' }}>{repo.stargazers_count}</span>
                        </div>
                      )}
                      {repo.forks_count > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <GitFork style={{ width: 11, height: 11, color: '#8b949e' }} />
                          <span style={{ fontSize: 11, color: '#8b949e' }}>{repo.forks_count}</span>
                        </div>
                      )}
                      {repo.updated_at && (
                        <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 'auto' }}>
                          Updated {timeAgo(repo.updated_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right arrow / open hint */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e' }}>
                    <Code2 style={{ width: 14, height: 14 }} />
                    <span style={{ fontSize: 11 }}>Open</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Empty state ── */
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Github style={{ width: 40, height: 40, color: '#30363d', margin: '0 auto 12px' }} />
            <p style={{ color: '#8b949e', fontSize: 14, margin: 0 }}>
              {searchQuery ? `No repositories match "${searchQuery}"` : 'No repositories found'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ marginTop: 12, fontSize: 13, color: '#2f81f7', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
