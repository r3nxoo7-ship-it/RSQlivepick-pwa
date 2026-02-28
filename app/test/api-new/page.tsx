'use client';

// ============================================
// R$Q - API TEST PAGE
// ============================================
// Testează conectivitatea cu Football-Data și API-Football

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';

export default function APITestPage() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const runTest = async () => {
    setTesting(true);
    setError(null);
    
    try {
      console.log('🧪 Testing APIs...');
      
      // Check API status
      const statusRes = await fetch('/api/status');
      if (statusRes.ok) {
        const apiStatus = await statusRes.json();
        setStatus(apiStatus);
      }
      
      // Try to fetch matches
      const matchesRes = await fetch('/api/matches/live');
      if (matchesRes.ok) {
        const { matches: liveMatches } = await matchesRes.json();
        setMatches(liveMatches);
      }
      
      console.log('✅ Test complete');
      
    } catch (err) {
      console.error('❌ Test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div>
            <h1 className="text-3xl font-display font-bold gradient-text mb-2">
              🧪 API Test
            </h1>
            <p className="text-text-secondary">
              Verifică conectivitatea cu Football-Data.org și API-Football
            </p>
          </div>
          
          <button
            onClick={runTest}
            disabled={testing}
            className="btn-primary flex items-center gap-2"
          >
            {testing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Run Test
              </>
            )}
          </button>
          
          {/* API Status */}
          {status && (
            <div className="space-y-4">
              <div className="glass-card p-6">
                <h3 className="text-xl font-display font-semibold mb-4">
                  📡 API Status
                </h3>
                
                <div className="space-y-3">
                  {/* Football-Data */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-glass-light">
                    <div>
                      <p className="font-semibold">Football-Data.org</p>
                      <p className="text-sm text-text-muted">{status.footballData.message}</p>
                    </div>
                    {status.footballData.success ? (
                      <CheckCircle className="w-6 h-6 text-accent-green" />
                    ) : (
                      <XCircle className="w-6 h-6 text-accent-red" />
                    )}
                  </div>
                  
                  {/* API-Football */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-glass-light">
                    <div>
                      <p className="font-semibold">API-Football</p>
                      <p className="text-sm text-text-muted">{status.apiFootball.message}</p>
                    </div>
                    {status.apiFootball.success ? (
                      <CheckCircle className="w-6 h-6 text-accent-green" />
                    ) : (
                      <XCircle className="w-6 h-6 text-accent-red" />
                    )}
                  </div>
                  
                  {/* Primary */}
                  <div className="p-4 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20">
                    <p className="text-sm">
                      <span className="font-semibold text-accent-cyan">Primary API:</span>{' '}
                      {status.primary === 'football-data' ? 'Football-Data.org' : 'API-Football'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Matches */}
              <div className="glass-card p-6">
                <h3 className="text-xl font-display font-semibold mb-4">
                  ⚽ Live Matches ({matches.length})
                </h3>
                
                {matches.length === 0 ? (
                  <p className="text-text-muted">No live matches at the moment</p>
                ) : (
                  <div className="space-y-2">
                    {matches.slice(0, 5).map((match) => (
                      <div key={match.fixture.id} className="p-3 rounded-lg bg-glass-light">
                        <p className="font-semibold">
                          {match.teams.home.name} vs {match.teams.away.name}
                        </p>
                        <p className="text-sm text-text-muted">
                          {match.league.name} • {match.goals.home} - {match.goals.away}
                          {match.fixture.status.elapsed && ` • ${match.fixture.status.elapsed}'`}
                        </p>
                      </div>
                    ))}
                    {matches.length > 5 && (
                      <p className="text-sm text-text-muted text-center pt-2">
                        ...and {matches.length - 5} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="glass-card p-6 border-l-4 border-accent-red">
              <h3 className="text-accent-red font-semibold mb-2">❌ Error</h3>
              <p className="text-text-secondary text-sm">{error}</p>
            </div>
          )}
          
          {/* Instructions */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-display font-semibold mb-4">
              📝 Setup Instructions
            </h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-accent-cyan mb-2">1. Get Football-Data.org API Key</p>
                <p className="text-text-muted mb-2">Visit: https://www.football-data.org/client/register</p>
                <p className="text-text-muted">FREE tier: 10 requests/minute = 14,400/day!</p>
              </div>
              
              <div>
                <p className="font-semibold text-accent-cyan mb-2">2. Add to .env.local</p>
                <pre className="p-3 rounded-lg bg-glass-dark text-accent-green font-mono text-xs overflow-x-auto">
{`NEXT_PUBLIC_FOOTBALL_DATA_KEY=your_key_here`}
                </pre>
              </div>
              
              <div>
                <p className="font-semibold text-accent-cyan mb-2">3. Restart server</p>
                <pre className="p-3 rounded-lg bg-glass-dark text-text-primary font-mono text-xs">
{`npm run dev`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
