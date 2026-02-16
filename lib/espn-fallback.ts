// ============================================
// ESPN FALLBACK DATA SOURCES (Compatibility Shim)
// ============================================
// This file re-exports from the new data-sources.ts module
// for backwards compatibility. New code should import from
// 'lib/data-sources' directly.

export {
  fallbackStats,
  getMatchesFromApify,
  isFallbackAvailable,
  getFallbackStatus,
} from './data-sources';
