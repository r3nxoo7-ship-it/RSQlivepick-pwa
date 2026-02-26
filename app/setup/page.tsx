'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ClipboardCopy, ExternalLink } from 'lucide-react';

export default function SetupPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'manual' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [sql, setSql] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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
  }, []);

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
          <div className="flex items-start gap-3 rounded-lg border border-green-700 bg-green-900/20 p-4">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-green-300">All good!</p>
              <p className="text-sm text-gray-300 mt-1">{message}</p>
              <a
                href="/register"
                className="inline-block mt-3 text-sm text-cyan-400 underline hover:text-cyan-300"
              >
                Back to registration →
              </a>
            </div>
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
              onClick={() => {
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
                    setMessage('Could not reach the setup API.');
                  });
              }}
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
