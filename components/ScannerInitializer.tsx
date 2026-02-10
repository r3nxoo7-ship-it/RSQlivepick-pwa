'use client';

import { useEffect } from 'react';
import { getBackgroundScanner } from '@/lib/background-scanner';
import { authHelpers } from '@/lib/supabase';
import { startESPNCron } from '@/lib/espn-cron';

export function ScannerInitializer() {
  useEffect(() => {
    // Start ESPN cron (1-minute sync) - runs once globally
    try {
      startESPNCron();
    } catch (error) {
      console.warn('ESPN cron startup warning:', error);
    }

    // Only initialize filter scanner if user is logged in
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      return;
    }

    const scanner = getBackgroundScanner();
    
    // Start background scanner (30-second intervals)
    // Runs in background regardless of which page user is on
    // scanner.start(30);   ← COMENTEAZĂ LINIA ASTA (sau șterge-o temporar)

    console.log('Scanner oprit temporar pentru a evita consumul mare de CPU');

    // Clean up if component unmounts (won't actually stop scanner due to singleton)
    return () => {
      // Note: we don't stop here because scanner should persist
      // User would need to explicitly logout or disable it
    };
  }, []);

  return null;
}
