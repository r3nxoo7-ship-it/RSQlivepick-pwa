'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Share2, Loader, Filter as FilterIcon, Bell, ToggleLeft, ToggleRight, Edit, Trash2, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dbHelpers, Filter } from '@/lib/supabase';
import { authHelpers } from '@/lib/supabase';
import PublicFilterCard from '@/components/PublicFilterCard';

export default function PublicFiltersPage() {
  const router = useRouter();
  const [publicFilters, setPublicFilters] = useState<Filter[]>([]);
  const [userFilters, setUserFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'community'>('my');

  const user = authHelpers.getCurrentUser();
  const userId = user?.id;

  const loadFilters = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📚 Loading public filters...');

      const publicList = await dbHelpers.getPublicFilters();
      console.log('✅ Public filters loaded:', publicList.length);

      const userList = userId ? await dbHelpers.getUserFilters(userId) : [];
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
  }, [userId]);

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
        className="sticky top-20 md:top-28 z-40 bg-background/80 backdrop-blur-md border-b border-glass-light/20 py-4 md:py-6"
      >
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <Share2 className="w-6 h-6 sm:w-8 sm:h-8 text-accent-cyan flex-shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent line-clamp-1">
              Community Library
            </h1>
          </div>
          <p className="text-xs sm:text-sm md:text-base text-text-secondary line-clamp-2">
            Import • Edit • Share filters
          </p>
          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'my'
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
                  : 'bg-glass-light text-text-secondary hover:bg-glass-lighter border border-transparent'
              }`}
            >
              🎯 My Filters ({userFilters.length})
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'community'
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/40'
                  : 'bg-glass-light text-text-secondary hover:bg-glass-lighter border border-transparent'
              }`}
            >
              🌍 Community ({publicFilters.length})
            </button>
          </div>
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
      ) : (
        <div className="container mx-auto px-3 sm:px-4 py-6 md:py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-6 md:mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-accent-cyan/10 to-cyan-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-xs sm:text-sm">My Filters</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-accent-cyan">{userFilters.length}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-accent-green/10 to-green-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-xs sm:text-sm">Active</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-accent-green">{userFilters.filter(f => f.is_active).length}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-accent-amber/10 to-amber-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-xs sm:text-sm">With Notifications</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-accent-amber">{userFilters.filter(f => f.notification_enabled).length}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-accent-blue/10 to-blue-900/5 border border-glass-light"
            >
              <div className="text-text-muted text-xs sm:text-sm">Community</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-accent-blue">{publicFilters.length}</div>
            </motion.div>
          </div>

          {/* ========== MY FILTERS TAB ========== */}
          {activeTab === 'my' && (
            <div>
              {userFilters.length === 0 ? (
                <div className="text-center py-16">
                  <FilterIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
                  <p className="text-text-muted mb-4">You don&apos;t have any filters yet.</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => router.push('/dashboard/filters/new')}
                      className="px-4 py-2 rounded-lg bg-accent-cyan text-black font-semibold text-sm hover:bg-accent-cyan/90 transition"
                    >
                      + Create Filter
                    </button>
                    <button
                      onClick={() => router.push('/dashboard/filters/templates')}
                      className="px-4 py-2 rounded-lg bg-glass-light text-text-primary font-semibold text-sm hover:bg-glass-lighter transition"
                    >
                      📚 Browse Templates
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {userFilters.map((filter, idx) => (
                    <motion.div
                      key={filter.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`glass-card-hover p-4 rounded-xl border-l-4 ${
                        filter.is_active ? 'border-accent-green' : 'border-glass-medium'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-display font-semibold text-base truncate">
                              {filter.name}
                            </h3>
                            {filter.is_active && (
                              <span className="px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-xs font-semibold whitespace-nowrap">
                                ACTIVE
                              </span>
                            )}
                            {filter.notification_enabled && (
                              <span className="px-1.5 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan text-xs flex items-center gap-1 whitespace-nowrap">
                                <Bell className="w-3 h-3" />
                              </span>
                            )}
                            {filter.telegram_enabled && (
                              <span className="px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-xs flex items-center gap-1 whitespace-nowrap">
                                <MessageCircle className="w-3 h-3" />
                              </span>
                            )}
                            {filter.is_public && (
                              <span className="px-1.5 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue text-xs flex items-center gap-1 whitespace-nowrap">
                                <Share2 className="w-3 h-3" /> Public
                              </span>
                            )}
                          </div>
                          {filter.description && (
                            <p className="text-xs text-text-muted line-clamp-1">{filter.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                            <span>Triggered: {filter.trigger_count || 0}</span>
                            {filter.success_rate !== null && filter.success_rate !== undefined && (
                              <span>Success: {filter.success_rate}%</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => router.push(`/dashboard/filters/${filter.id}`)}
                            className="p-2 rounded-lg hover:bg-glass-light transition"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-accent-cyan" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => router.push('/dashboard/filters/new')}
                      className="px-4 py-2 rounded-lg bg-accent-cyan text-black font-semibold text-sm hover:bg-accent-cyan/90 transition"
                    >
                      + Create Filter
                    </button>
                    <button
                      onClick={() => router.push('/dashboard/filters/templates')}
                      className="px-4 py-2 rounded-lg bg-glass-light text-text-primary font-semibold text-sm hover:bg-glass-lighter transition"
                    >
                      📚 Browse Templates
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== COMMUNITY TAB ========== */}
          {activeTab === 'community' && (
            <div>
              {publicFilters.length === 0 ? (
                <div className="text-center py-16">
                  <Share2 className="w-12 h-12 text-text-muted mx-auto mb-4" />
                  <p className="text-text-muted">No public filters available yet. Be the first to share!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
