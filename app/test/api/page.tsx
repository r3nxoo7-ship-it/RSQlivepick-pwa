'use client'; // Această linie spune Next.js că e un client component (rulează în browser)

// ============================================
// R$Q - API FOOTBALL TEST PAGE
// ============================================
// This page tests whether API-Football works correctly
// For beginners: learn useState, onClick, and async functions

// Importăm ce avem nevoie din React
import { useState } from 'react'; // useState = memorie pentru component

// Importăm funcțiile din api-football.ts
import { 
  getLiveMatches,           // Funcția care ia meciuri live
  LiveMatch                 // Type-ul pentru meci
} from '@/lib/api-football';

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function APITestPage() {
  // ============================================
  // STATE (memoria componentei)
  // ============================================
  
  // matches = array cu meciuri (inițial gol: [])
  // setMatches = funcție care schimbă matches
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  
  // loading = true când facem request, false când nu
  const [loading, setLoading] = useState(false);
  
  // error = mesaj de eroare (sau null dacă totul e ok)
  const [error, setError] = useState<string | null>(null);
  
  // ============================================
  // FUNCȚIE PENTRU FETCH MATCHES
  // ============================================
  
  /**
   * Această funcție:
   * 1. Setează loading = true
   * 2. Face request la API
   * 3. Salvează meciurile în state
   * 4. Setează loading = false
   */
  const handleFetchMatches = async () => {
    // Reset error
    setError(null);
    
    // Start loading
    setLoading(true);
    
    try {
      // EXPLICAȚIE:
      // await = așteaptă până primim răspuns
      // getLiveMatches() = funcția din api-football.ts
      console.log('🔍 Fetching live matches...');
      const liveMatches = await getLiveMatches();
      
      // Salvăm meciurile în state
      setMatches(liveMatches);
      
      console.log(`✅ Found ${liveMatches.length} live matches!`);
    } catch (err) {
      // Dacă ceva merge prost, prindem eroarea
      console.error('❌ Error fetching matches:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      // Indiferent ce se întâmplă, oprește loading
      setLoading(false);
    }
  };
  
  // ============================================
  // RENDER (ce se afișează pe ecran)
  // ============================================
  
  return (
    <div className="min-h-screen p-8 bg-primary">
      {/* Container principal */}
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold gradient-text mb-2">
            🧪 API Football Test Page
          </h1>
          <p className="text-text-secondary">
            Test whether API-Football is working correctly
          </p>
        </div>
        
        {/* Buton pentru fetch */}
        <div className="mb-6">
          <button
            onClick={handleFetchMatches}  // Când dai click, rulează funcția
            disabled={loading}             // Disabled când e loading
            className="btn-primary"
          >
            {loading ? (
              // Dacă e loading, afișează spinner
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    fill="none" 
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
                  />
                </svg>
                Fetching...
              </span>
            ) : (
              // Dacă NU e loading, text normal
              '⚽ Fetch Live Matches'
            )}
          </button>
        </div>
        
        {/* Eroare (dacă există) */}
        {error && (
          <div className="glass-card p-4 border-l-4 border-accent-red mb-6">
            <h3 className="text-accent-red font-semibold mb-1">
              ❌ Error
            </h3>
            <p className="text-text-secondary text-sm">{error}</p>
            <p className="text-xs text-text-muted mt-2">
              💡 Check that .env.local contains the correct API_FOOTBALL_KEY!
            </p>
          </div>
        )}
        
        {/* Rezultate */}
        {matches.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-2xl font-display font-bold mb-4">
              🎯 Live Matches: {matches.length}
            </h2>
            
            {/* Lista cu meciuri */}
            <div className="space-y-4">
              {matches.map((match) => (
                // Pentru fiecare meci, afișăm un card
                <div 
                  key={match.fixture.id}  // ID unic pentru React
                  className="glass-card-hover p-4 border-l-4 border-accent-cyan"
                >
                  {/* Liga */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-text-muted">
                      {match.league.name} • {match.league.country}
                    </span>
                    {/* LIVE indicator */}
                    <span className="px-2 py-0.5 rounded-full bg-accent-red text-xs font-bold">
                      🔴 LIVE {match.fixture.status.elapsed}&apos;
                    </span>
                  </div>
                  
                  {/* Teams + Score */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    {/* Echipa gazdă */}
                    <div className="text-right">
                      <p className="font-semibold">{match.teams.home.name}</p>
                    </div>
                    
                    {/* Score */}
                    <div className="text-center">
                      <div className="text-3xl font-bold gradient-text">
                        {match.goals.home ?? 0} - {match.goals.away ?? 0}
                      </div>
                    </div>
                    
                    {/* Echipa oaspete */}
                    <div className="text-left">
                      <p className="font-semibold">{match.teams.away.name}</p>
                    </div>
                  </div>
                  
                  {/* Info extra */}
                  <div className="mt-3 pt-3 border-t border-glass-medium text-xs text-text-muted">
                    <p>Match ID: {match.fixture.id}</p>
                    <p>Status: {match.fixture.status.long}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Mesaj dacă nu sunt meciuri */}
        {!loading && !error && matches.length === 0 && (
          <div className="glass-card p-12 text-center">
            <p className="text-text-secondary text-lg mb-2">
              👆 Click the button above to load live matches!
            </p>
            <p className="text-text-muted text-sm">
              💡 If there are no live matches, try again later when real matches are playing
            </p>
          </div>
        )}
        
        {/* Info despre API */}
        <div className="mt-8 glass-card p-4 text-sm">
          <h3 className="font-semibold mb-2 text-accent-cyan">
            📊 API Info
          </h3>
          <ul className="space-y-1 text-text-muted">
            <li>• Free Plan: 100 requests/day</li>
            <li>• Endpoint: /fixtures?live=all</li>
            <li>• Response: List of live matches with statistics</li>
            <li>• Update: La fiecare request (manual)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
