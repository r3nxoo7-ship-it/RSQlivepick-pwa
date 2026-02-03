// ============================================
// BACKGROUND SCANNER INITIALIZER
// ============================================
// Initializes background scanning when app mounts
// Runs in the root layout to ensure it persists across all pages

'use client';

import { useEffect } from 'react';
import { getBackgroundScanner } from '@/lib/background-scanner';
import { authHelpers } from '@/lib/supabase';

export function ScannerInitializer() {
  useEffect(() => {
    // Only initialize if user is logged in
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      return;
    }

    const scanner = getBackgroundScanner();
    
    // Start background scanner (30-second intervals)
    // Runs in background regardless of which page user is on
    scanner.start(30);

    // Clean up if component unmounts (won't actually stop scanner due to singleton)
    return () => {
      // Note: we don't stop here because scanner should persist
      // User would need to explicitly logout or disable it
    };
  }, []);

  return null;
}
