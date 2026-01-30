'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Share2, Loader } from 'lucide-react';
import { dbHelpers, Filter } from '@/lib/supabase';
import { authHelpers } from '@/lib/supabase';
import PublicFilterCard from '@/components/PublicFilterCard';

export default function PublicFiltersPage() {
  const [publicFilters, setPublicFilters] = useState<Filter[]>([]);
  const [userFilters, setUserFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const user = authHelpers.getCurrentUser();

  const loadFilters = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📚 Loading public filters...');
      
      const publicList = await dbHelpers.getPublicFilters();
      console.log('✅ Public filters loaded:', publicList.length);
      
      const userList = user ? await dbHelpers.getUserFilters(user.id) : [];
      console.log('✅ User filters loaded:', userList.length);

      setPublicFilters(publicList);
      setUserFilters(userList);
      
      if (publicList.length === 0) {
        console.warn('⚠️ No public filters available');
      }
    } catch (err) {
      console.error('Error loading filters:', err);
      setMessage({ type: 'error', text: 'Failed to load public filters' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const handleImport = async (sourceFilterId: string) => {
    if (!user) {
      setMessage({ type: 'error', text: 'Please log in to import filters' });
      return;
    }

    try {
      setImporting(sourceFilterId);
      const result = await dbHelpers.importPublicFilter(sourceFilterId, user.id);

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: `Filter imported as v2.0! Check your library.` });
        // Reload user filters
        const updated = await dbHelpers.getUserFilters(user.id);
        setUserFilters(updated);
      }
    } catch (err) {
      console.error('Error importing filter:', err);
      setMessage({ type: 'error', text: 'Failed to import filter' });
    } finally {
      setImporting(null);
    }
  };

  const isAlreadyImported = (filterId: string) => {
    return userFilters.some(f => f.forked_from_id === filterId);
  };

  return (
    <div className="min-h-screen bg-background pt-20 md:pt-28 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-20 md:top-28 z-40 bg-background/80 backdrop-blur-md border-b border-glass-light/20 py-6"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <Share2 className="w-8 h-8 text-accent-cyan" />
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent">
              Community Library
            </h1>
          </div>
          <p className="text-text-secondary mt-1">
            Import filters from the community • Edit your own version (v2.0) • Share your filters
          </p>
        </div>
      </motion.div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`sticky top-40 md:top-48 z-40 mx-4 mt-4 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-8 h-8 animate-spin text-accent-cyan" />
        </div>
      ) : publicFilters.length === 0 ? (
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-text-muted">No public filters available yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-gradient-to-br from-accent-cyan/10 to-cyan-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-sm">Available</div>
              <div className="text-3xl font-bold text-accent-cyan">{publicFilters.length}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-lg bg-gradient-to-br from-accent-green/10 to-green-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-sm">You Imported</div>
              <div className="text-3xl font-bold text-accent-green">{userFilters.filter(f => f.forked_from_id).length}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-lg bg-gradient-to-br from-accent-amber/10 to-amber-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-sm">Your Filters</div>
              <div className="text-3xl font-bold text-accent-amber">{userFilters.filter(f => !f.forked_from_id).length}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-lg bg-gradient-to-br from-accent-blue/10 to-blue-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-sm">Public Filters</div>
              <div className="text-3xl font-bold text-accent-blue">{userFilters.filter(f => f.is_public).length}</div>
            </motion.div>
          </div>

          {/* Public Filters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {publicFilters.map((filter, idx) => (
              <motion.div
                key={filter.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <PublicFilterCard
                  filter={filter}
                  onImport={() => handleImport(filter.id)}
                  isLoading={importing === filter.id}
                  alreadyImported={isAlreadyImported(filter.id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
