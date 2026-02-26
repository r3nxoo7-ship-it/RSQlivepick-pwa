'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ClipboardCopy, ExternalLink } from 'lucide-react';

export default function SetupPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'manual' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [sql, setSql] = useState('');
  const [copied, setCopied] = useState(false);
  const [diagStatus, setDiagStatus] = useState<'idle' | 'running' | 'pass' | 'fail'>('idle');
  const [diagResult, setDiagResult] = useState<{
    ok: boolean;
    stage?: string;
    error?: string;
    hint?: string;
    message?: string;
    isTriggerError?: boolean;
    fixSql?: string | null;
  } | null>(null);
  const [fixCopied, setFixCopied] = useState(false);

  const runSetupCheck = () => {
    setStatus('loading');
    fetch('/api/setup')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setStatus('ok');
          setMessage(data.message);
        } else {
          setStatus('manual');
          setMessage(data.message);
          setSql(data.sql || '');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not reach the setup API. Check your server logs.');
      });
  };

  const runDiagnostic = () => {
    setDiagStatus('running');
    setDiagResult(null);
    fetch('/api/setup', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        setDiagResult(data);
        setDiagStatus(data.ok ? 'pass' : 'fail');
      })
      .catch(() => {
        setDiagResult({ ok: false, error: 'Could not reach diagnostic API.' });
        setDiagStatus('fail');
      });
  };

  useEffect(() => { runSetupCheck(); }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">Database Setup</h1>
          <p className="text-gray-400 mt-1 text-sm">
            This page checks whether required database tables exist and helps you create them.
          </p>
        </div>

        {status === 'loading' && (
          <div className="flex items-center gap-3 text-gray-300">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span>Checking database…</span>
          </div>
        )}

        {status === 'ok' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-green-700 bg-green-900/20 p-4">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-green-300">Profiles table exists</p>
                <p className="text-sm text-gray-300 mt-1">{message}</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-200">Still getting errors registering? Run the full diagnostic:</p>
              <button
                onClick={runDiagnostic}
                disabled={diagStatus === 'running'}
                className="flex items-center gap-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                {diagStatus === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {diagStatus === 'running' ? 'Running test…' : 'Run diagnostic test'}
              </button>

              {diagStatus === 'pass' && (
                <div className="flex items-start gap-2 text-green-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{diagResult?.message ?? 'All good — registration should work now.'}</span>
                </div>
              )}

              {diagStatus === 'fail' && diagResult && (
                <div className="rounded-lg border border-red-700 bg-red-900/20 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-red-300 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Failed at: <span className="font-mono">{diagResult.stage ?? 'unknown'}</span>
                  </div>
                  <p className="text-xs text-red-400 font-mono break-all">{diagResult.error}</p>
                  {diagResult.hint && <p className="text-xs text-gray-300">{diagResult.hint}</p>}

                  {diagResult.isTriggerError && diagResult.fixSql && (
                    <div className="space-y-2 pt-1 border-t border-red-800">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-amber-300">Fix: run this SQL in Supabase SQL Editor</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(diagResult.fixSql!).then(() => {
                              setFixCopied(true);
                              setTimeout(() => setFixCopied(false), 2500);
                            });
                          }}
                          className="flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 transition-colors"
                        >
                          <ClipboardCopy className="w-3 h-3" />
                          {fixCopied ? 'Copied!' : 'Copy SQL'}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded bg-gray-900 border border-gray-700 p-3 text-xs text-gray-300 leading-relaxed">
                        {diagResult.fixSql}
                      </pre>
                      <a
                        href={sqlEditorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 underline hover:text-cyan-300 text-xs"
                      >
                        Open Supabase SQL Editor <ExternalLink className="w-3 h-3" />
                      </a>
                      <p className="text-xs text-gray-400">After running the SQL, click &ldquo;Run diagnostic test&rdquo; again to confirm.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <a
              href="/register"
              className="block text-center rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2.5 transition-colors"
            >
              Back to registration &rarr;
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 rounded-lg border border-red-700 bg-red-900/20 p-4">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-300">{message}</p>
          </div>
        )}

        {status === 'manual' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-700 bg-amber-900/20 p-4">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-amber-300 mb-1">Manual step required (30 seconds)</p>
                <p>{message}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-300">Step 1 — Copy this SQL</p>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy SQL'}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-gray-900 border border-gray-700 p-4 text-xs text-gray-300 leading-relaxed">
                {sql}
              </pre>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-2 text-sm">
              <p className="font-medium text-gray-200">Step 2 — Run it in Supabase SQL Editor</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>
                  Open{' '}
                  <a
                    href={sqlEditorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-400 underline hover:text-cyan-300"
                  >
                    Supabase SQL Editor
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Click <span className="text-white font-medium">New query</span></li>
                <li>Paste the SQL above into the editor</li>
                <li>Click <span className="text-white font-medium">Run</span> (green button)</li>
                <li>Come back here and click the button below</li>
              </ol>
            </div>

            <button
              onClick={runSetupCheck}
              className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2.5 transition-colors"
            >
              I ran the SQL — check again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
