'use client';

// ============================================
// R$Q - FILTERS PAGE (VERSIUNE COMPLETĂ)
// ============================================
// TOATE funcțiile CRUD implementate complet

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Filter as FilterIcon,
  Bell,
  BellOff,
  MessageCircle,
  Send,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter } from '@/lib/supabase';

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function FiltersPage() {
  const router = useRouter();
  
  // ============================================
  // STATE
  // ============================================
  
  const [filters, setFilters] = useState<Filter[]>([]);
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingNotifications, setUpdatingNotifications] = useState<string[]>([]);
  const [updatingTelegram, setUpdatingTelegram] = useState<string[]>([]);
  const [lastApiDebug, setLastApiDebug] = useState<any>(null);
  // Multi-select state for mobile bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Stale (never-triggered) filters
  const [staleFilters, setStaleFilters] = useState<{id: string; name: string; created_at: string}[]>([]);
  const [staleLoading, setStaleLoading] = useState(false);
  // Stats bar filter
  const [activeStatFilter, setActiveStatFilter] = useState<'all' | 'active' | 'push' | 'telegram' | 'never_triggered'>('all');
  
  // ============================================
  // LOAD FILTERS
  // ============================================
  
  const loadFilters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      console.log('🔍 Loading filters for user:', currentUser.id);

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const userFilters = await dbHelpers.getUserFilters(currentUser.id);

      console.log(`✅ Loaded ${userFilters.length} filters at ${timestamp}`);
      console.log('📋 Filter IDs in UI:', userFilters.map(f => `${f.id.substring(0, 8)}... (${f.name})`));
      
      // Log if count decreased
      if (filters.length > userFilters.length) {
        console.log(`✅ Filter count decreased from ${filters.length} to ${userFilters.length}`);
      };

      setFilters(userFilters);
      // pick up any diagnostic info written to window by dbHelpers
      if (typeof window !== 'undefined' && (window as any).__lastFiltersApi) {
        setLastApiDebug((window as any).__lastFiltersApi);
      } else {
        setLastApiDebug(null);
      }
    } catch (err) {
      console.error('❌ Error loading filters:', err);
      setError('Error loading filters');
    } finally {
      setLoading(false);
    }
  }, [router, filters.length]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  // ============================================
  // LOAD STALE (NEVER-TRIGGERED) FILTERS
  // ============================================

  const loadStaleFilters = useCallback(async () => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;
      const res = await fetch(`/api/filters/cleanup-stale?user_id=${encodeURIComponent(currentUser.id)}`);
      if (!res.ok) return;
      const json = await res.json();
      setStaleFilters(json.staleFilters || []);
    } catch {
      // silent — non-critical
    }
  }, []);

  useEffect(() => {
    loadStaleFilters();
  }, [loadStaleFilters]);

  const handleStaleAction = async (action: 'deactivate' | 'delete', filterIds?: string[]) => {
    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) return;

    const count = filterIds?.length || staleFilters.length;
    const verb = action === 'delete' ? 'delete' : 'deactivate';
    if (!confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${count} never-triggered filter${count !== 1 ? 's' : ''}?`)) return;

    setStaleLoading(true);
    try {
      const res = await fetch('/api/filters/cleanup-stale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, action, filter_ids: filterIds }),
      });
      const json = await res.json();
      if (res.ok && json.affected > 0) {
        alert(`✅ ${json.affected} filter${json.affected !== 1 ? 's' : ''} ${json.action}`);
        await loadFilters();
        await loadStaleFilters();
      } else if (json.error) {
        alert(`Error: ${json.error}`);
      }
    } catch {
      alert('Error performing cleanup');
    } finally {
      setStaleLoading(false);
    }
  };
  
  // ============================================
  // HANDLERS - VERSIUNE COMPLETĂ
  // ============================================
  
  /**
   * Toggle filter notifications
   */
  const handleToggleNotifications = async (filterId: string, currentStatus: boolean) => {
    console.log('🔔 Toggling notifications (optimistic):', filterId, 'from', currentStatus, 'to', !currentStatus);

    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      alert('Please log in');
      return;
    }

    // Optimistic UI update
    setUpdatingNotifications(prev => [...prev, filterId]);
    setFilters(prev => prev.map(f => f.id === filterId ? { ...f, notification_enabled: !currentStatus } : f));

    try {
      const response = await fetch('/api/filters/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          filterId: filterId,
          updates: { notification_enabled: !currentStatus },
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        console.error('❌ Toggle notifications failed:', data.error || response.statusText);
        // Revert optimistic update
        setFilters(prev => prev.map(f => f.id === filterId ? { ...f, notification_enabled: currentStatus } : f));
        alert(`Error: ${data.error || 'Failed to update notifications'}`);
        return;
      }

      // Ensure fresh data
      await loadFilters();
    } catch (err) {
      console.error('❌ Exception in handleToggleNotifications:', err);
      // Revert optimistic update
      setFilters(prev => prev.map(f => f.id === filterId ? { ...f, notification_enabled: currentStatus } : f));
      alert('Error updating notifications');
    } finally {
      setUpdatingNotifications(prev => prev.filter(id => id !== filterId));
    }
  };

  /**
   * Toggle filter Telegram notifications
   */
  const handleToggleTelegram = async (filterId: string, currentStatus: boolean) => {
    console.log('📨 Toggling Telegram (optimistic):', filterId, 'from', currentStatus, 'to', !currentStatus);

    const currentUser = authHelpers.getCurrentUser();
    if (!currentUser) {
      alert('Please log in');
      return;
    }

    // Optimistic UI update
    setUpdatingTelegram(prev => [...prev, filterId]);
    setFilters(prev => prev.map(f => f.id === filterId ? { ...f, telegram_enabled: !currentStatus } : f));

    try {
      const response = await fetch('/api/filters/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          filterId: filterId,
          updates: { telegram_enabled: !currentStatus },
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        console.error('❌ Toggle Telegram failed:', data.error || response.statusText);
        setFilters(prev => prev.map(f => f.id === filterId ? { ...f, telegram_enabled: currentStatus } : f));
        alert(`Error: ${data.error || 'Failed to update Telegram notifications'}`);
        return;
      }

      await loadFilters();
    } catch (err) {
      console.error('❌ Exception in handleToggleTelegram:', err);
      setFilters(prev => prev.map(f => f.id === filterId ? { ...f, telegram_enabled: currentStatus } : f));
      alert('Error updating Telegram notifications');
    } finally {
      setUpdatingTelegram(prev => prev.filter(id => id !== filterId));
    }
  };

  /**
   * Toggle filter active/inactive - IMPLEMENTARE COMPLETĂ
   */
  const handleToggleActive = async (filterId: string, currentStatus: boolean) => {
    console.log('🔄 Toggling filter:', filterId, 'from', currentStatus, 'to', !currentStatus);
    
    try {
      // Apelăm funcția din supabase.ts
      const { data, error } = await dbHelpers.toggleFilterActive(filterId, currentStatus);
      
      if (error) {
        console.error('❌ Toggle error:', error);
        alert(`Error: ${error}`);
        return;
      }
      
      console.log('✅ Filter toggled successfully:', data);
      
      // Reload filters to reflect the change
      await loadFilters();
      
    } catch (err) {
      console.error('❌ Exception in handleToggleActive:', err);
      alert('Error changing status');
    }
  };
  
  /**
   * Delete filter - FIXED: Remove from state immediately + reload
   */
  const handleDelete = async (filterId: string, filterName: string) => {
    // Confirmare
    const confirmed = confirm(`Delete filter "${filterName}"?\n\n• The filter will be permanently removed from your list\n• Your triggered match history is preserved\n• Templates and library filters are not affected`);
    if (!confirmed) {
      console.log('❌ Delete cancelled by user');
      return;
    }

    console.log('🗑️ Deleting filter:', filterId, filterName);
    console.log('📊 Total filters before delete:', filters.length);

    try {
      // Optimistic update: remove from UI immediately
      setFilters(prevFilters => prevFilters.filter(f => f.id !== filterId));

      // Call API to delete from database
      const { error } = await dbHelpers.deleteFilter(filterId);

      if (error) {
        console.error('❌ Delete error:', error);

        // Check if filter doesn't exist in database
        if (error.includes('not found') || error.includes('404')) {
          alert(`⚠️ Filter "${filterName}" was not found in the database.\n\nThis may be stale data. Refreshing your filter list...`);
          // Don't restore - it doesn't exist anyway, just refresh
          await loadFilters();
          return;
        }

        alert(`Error deleting filter: ${error}`);
        // Reload to restore the filter if delete failed
        await loadFilters();
        return;
      }

      console.log('✅ Filter deleted successfully from database');
      alert(`✅ Filter "${filterName}" deleted successfully!`);

      // Wait longer to ensure DB write is fully propagated
      // Increased from 500ms to 1000ms (1 second) to handle replication delays
      console.log('⏳ Waiting for database propagation...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Hard refresh to bust any caches and reload filters
      console.log('🔄 Refreshing page to reload filters...');
      router.refresh();
      
      // Also reload filters explicitly
      await loadFilters();

    } catch (err) {
      console.error('❌ Exception in handleDelete:', err);
      alert(`Error deleting filter: ${err}`);
      // Reload to restore correct state
      await loadFilters();
    }
  };
  
  /**
   * Navigate to create new filter
   */
  const handleCreateNew = () => {
    console.log('➕ Navigating to create new filter');
    router.push('/dashboard/filters/new');
  };
  
  /**
   * Navigate to edit filter
   */
  const handleEdit = (filterId: string) => {
    console.log('✏️ Navigating to edit filter:', filterId);
    router.push(`/dashboard/filters/${filterId}`);
  };
  
  // ============================================
  // RENDER HELPERS
  // ============================================
  
  /**
  * Return the number of conditions in a filter
   */
  const getConditionsCount = (filter: Filter): number => {
    return Object.keys(filter.conditions).length;
  };
  
  /**
  * Return a text preview of conditions
   */
  const getConditionsPreview = (filter: Filter): string => {
    const conditions = filter.conditions;
    const preview: string[] = [];
    
    // Corners
      if (conditions.corners) {
      const c = conditions.corners;
      if (c.min) preview.push(`Corners >${c.min}`);
    }
    
    // Shots
    if (conditions.shots_on_target?.min) {
      preview.push(`Shots >${conditions.shots_on_target.min}`);
    }
    
    // Cards
    if (conditions.yellow_cards?.min) {
      preview.push(`Yellow cards >${conditions.yellow_cards.min}`);
    }
    
    // Minute
    if (conditions.match_time) {
      const t = conditions.match_time;
      preview.push(`${t.min || 0}'-${t.max || 90}'`);
    }
    
    return preview.slice(0, 3).join(' • ') + (preview.length > 3 ? '...' : '');
  };

  // ===== Computed filtered list =====
  const displayedFilters = useMemo(() => {
    switch (activeStatFilter) {
      case 'active': return filters.filter(f => f.is_active);
      case 'push': return filters.filter(f => f.notification_enabled);
      case 'telegram': return filters.filter(f => f.telegram_enabled);
      case 'never_triggered': return filters.filter(f => f.trigger_count === 0 && !f.last_triggered);
      default: return filters;
    }
  }, [filters, activeStatFilter]);

  // ===== Multi-select handlers =====
  const toggleSelect = (filterId: string) => {
    setSelectedIds(prev => prev.includes(filterId) ? prev.filter(id => id !== filterId) : [...prev, filterId]);
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkToggleActive = async (activate: boolean) => {
    if (selectedIds.length === 0) return;
    const confirmMsg = activate ? 'Activate selected filters?' : 'Deactivate selected filters?';
    if (!confirm(confirmMsg)) return;

    try {
      // Parallelize toggles
      await Promise.all(selectedIds.map(id => dbHelpers.toggleFilterActive(id, !activate === false ? false : true)));
      await loadFilters();
      clearSelection();
      alert('Bulk update completed');
    } catch (err) {
      console.error('Bulk toggle error:', err);
      alert('Error performing bulk update');
      await loadFilters();
      clearSelection();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = confirm(`Are you sure you want to delete ${selectedIds.length} filters? This cannot be undone.`);
    if (!confirmed) return;

    try {
      // Optimistic UI removal
      setFilters(prev => prev.filter(f => !selectedIds.includes(f.id)));
      await Promise.all(selectedIds.map(id => dbHelpers.deleteFilter(id)));
      await loadFilters();
      clearSelection();
      alert('Selected filters deleted');
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Error deleting filters');
      await loadFilters();
      clearSelection();
    }
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* ========== HEADER ========== */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text mb-2">
                🎯 My Filters
              </h1>
              <p className="text-text-secondary">
                Create and manage custom filters for matches
              </p>
            </div>

            {/* Header actions moved to the quick toolbar below for better spacing */}
            <div />
          </div>
          
          {/* ========== STATS (clickable filter buttons) ========== */}
          <div className="glass-card p-4 sm:p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              {[
                { key: 'all' as const, label: 'Total', value: filters.length, color: '' },
                { key: 'active' as const, label: 'Active', value: filters.filter(f => f.is_active).length, color: 'text-accent-green' },
                { key: 'push' as const, label: 'Browser Push', value: filters.filter(f => f.notification_enabled).length, color: 'text-accent-cyan' },
                { key: 'telegram' as const, label: 'Telegram', value: filters.filter(f => f.telegram_enabled).length, color: 'text-accent-blue' },
                { key: 'never_triggered' as const, label: 'Never Triggered', value: filters.filter(f => f.trigger_count === 0 && !f.last_triggered).length, color: filters.filter(f => f.trigger_count === 0 && !f.last_triggered).length > 0 ? 'text-accent-yellow' : 'text-text-muted' },
              ].map(stat => (
                <button
                  key={stat.key}
                  onClick={() => setActiveStatFilter(prev => prev === stat.key ? 'all' : stat.key)}
                  className={`text-center rounded-lg py-2 px-1 transition-all ${
                    activeStatFilter === stat.key
                      ? 'ring-2 ring-accent-cyan bg-accent-cyan/10 scale-[1.03]'
                      : 'hover:bg-glass-light'
                  } ${stat.key === 'never_triggered' ? 'col-span-2 md:col-span-1' : ''}`}
                >
                  <div className="stat-label text-xs sm:text-sm">{stat.label}</div>
                  <div className={`stat-value text-xl sm:text-2xl ${stat.color}`}>{stat.value}</div>
                </button>
              ))}
            </div>
            {activeStatFilter !== 'all' && (
              <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                <span>
                  Showing <span className="font-semibold text-accent-cyan">{displayedFilters.length}</span> of {filters.length} filters
                  {' — '}
                  <span className="capitalize">{activeStatFilter.replace('_', ' ')}</span>
                </span>
                <button
                  onClick={() => setActiveStatFilter('all')}
                  className="text-accent-cyan hover:underline"
                >
                  Show all
                </button>
              </div>
            )}
          </div>
          
          {/* ========== LOADING ========== */}
          {loading && (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-text-secondary">Loading filters...</p>
            </div>
          )}
          
          {/* ========== ERROR ========== */}
          {error && (
            <div className="glass-card p-6 border-l-4 border-accent-red">
              <h3 className="text-accent-red font-semibold mb-2">❌ Error</h3>
              <p className="text-text-secondary text-sm">{error}</p>
            </div>
          )}

          {/* ========== STALE FILTERS WARNING ========== */}
          {staleFilters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 sm:p-6 border-l-4 border-accent-yellow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-accent-yellow flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-accent-yellow">
                      {staleFilters.length} filter{staleFilters.length !== 1 ? 's' : ''} never triggered
                    </h3>
                    <p className="text-text-muted text-sm mt-1">
                      These filters are older than 7 days and have never matched a live match. Consider updating their conditions or removing them.
                    </p>
                    <div className="mt-2 space-y-1">
                      {staleFilters.slice(0, 5).map(sf => (
                        <div key={sf.id} className="flex items-center gap-2 text-xs text-text-secondary">
                          <Clock className="w-3 h-3 text-text-muted" />
                          <span className="font-medium">{sf.name}</span>
                          <span className="text-text-muted">— created {new Date(sf.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                      {staleFilters.length > 5 && (
                        <p className="text-xs text-text-muted">...and {staleFilters.length - 5} more</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleStaleAction('deactivate')}
                    disabled={staleLoading}
                    className="px-4 py-2 rounded-md border border-accent-yellow bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/15 transition-colors text-sm font-semibold disabled:opacity-50"
                  >
                    Deactivate All
                  </button>
                  <button
                    onClick={() => handleStaleAction('delete')}
                    disabled={staleLoading}
                    className="px-4 py-2 rounded-md border border-accent-red bg-accent-red/10 text-accent-red hover:bg-accent-red/15 transition-colors text-sm font-semibold disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                    Delete All
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========== ACTIONS TOOLBAR ========== */}
          {!loading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 border border-glass-medium"
            >
              {selectedIds.length > 0 ? (
                <div className="max-w-4xl mx-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-accent-cyan">
                      {selectedIds.length} filter{selectedIds.length !== 1 ? 's' : ''} selected
                    </div>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      onClick={() => handleBulkToggleActive(true)}
                      className="flex-1 text-center px-4 py-3 rounded-md border border-accent-green bg-accent-green/10 text-accent-green hover:bg-accent-green/15 transition-colors text-sm font-semibold"
                      title={`Activate ${selectedIds.length} filter${selectedIds.length !== 1 ? 's' : ''}`}
                    >
                      ✓ Activate Selected
                    </button>
                    <button
                      onClick={() => handleBulkToggleActive(false)}
                      className="flex-1 text-center px-4 py-3 rounded-md border border-accent-yellow bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/15 transition-colors text-sm font-semibold"
                      title={`Deactivate ${selectedIds.length} filter${selectedIds.length !== 1 ? 's' : ''}`}
                    >
                      ⊘ Deactivate Selected
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="flex-1 text-center px-4 py-3 rounded-md border border-accent-red bg-accent-red/10 text-accent-red hover:bg-accent-red/15 transition-colors text-sm font-semibold"
                      title={`Delete ${selectedIds.length} filter${selectedIds.length !== 1 ? 's' : ''}`}
                    >
                      <Trash2 className="w-4 h-4 inline mr-2" />
                      Delete Selected
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleCreateNew}
                    className="flex-1 text-center px-4 py-3 rounded-md border border-accent-cyan bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/15 transition-colors"
                    title="Create a new filter"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Create Filter
                  </button>

                  <button
                    onClick={() => router.push('/dashboard/filters/new?mode=super')}
                    className="flex-1 text-center px-4 py-3 rounded-md border border-glass-medium hover:bg-glass-light transition-colors"
                    title="Create a super filter by combining existing filters"
                  >
                    <span className="inline mr-2">🔗</span>
                    Super Filter
                  </button>

                  <button
                    onClick={() => router.push('/dashboard/filters/templates')}
                    className="flex-1 text-center px-4 py-3 rounded-md border border-glass-medium hover:bg-glass-light transition-colors"
                    title="Browse predefined templates"
                  >
                    <span className="inline mr-2">📚</span>
                    Templates
                  </button>
                </div>
              )}
            </motion.div>
          )}
          
          {/* ========== FILTERS LIST ========== */}
          {!loading && !error && displayedFilters.length > 0 && (
            <div className="space-y-4">
              {displayedFilters.map((filter, index) => {
                const isOpen = openFilterId === filter.id;
                return (
                  <motion.div
                    key={filter.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`glass-card-hover p-0 border-l-4 ${filter.trigger_count === 0 && !filter.last_triggered ? 'border-accent-yellow' : filter.is_active ? 'border-accent-green' : 'border-glass-medium'}`}
                  >
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 w-4 h-4 text-accent-cyan"
                            checked={selectedIds.includes(filter.id)}
                            onChange={() => toggleSelect(filter.id)}
                            aria-label={`Select filter ${filter.name}`}
                          />
                          {/* eslint-disable-next-line jsx-a11y/aria-role, jsx-a11y/aria-proptypes */}
                          {isOpen ? (
                            <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer" onClick={() => setOpenFilterId(isOpen ? null : filter.id)} role="button" tabIndex={0} aria-expanded="true">
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h3 className="text-lg sm:text-xl font-display font-semibold break-words">
                                  {filter.name}
                                </h3>
                                {filter.is_active && (
                                  <span className="px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-xs font-semibold whitespace-nowrap">
                                    ACTIVE
                                  </span>
                                )}
                                {filter.notification_enabled && (
                                  <span className="px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan text-xs flex items-center gap-1 whitespace-nowrap">
                                    <Bell className="w-3 h-3" />
                                    Push
                                  </span>
                                )}
                                {filter.telegram_enabled && (
                                  <span className="px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue text-xs flex items-center gap-1 whitespace-nowrap">
                                    <Send className="w-3 h-3" />
                                    Telegram
                                  </span>
                                )}
                                {!filter.notification_enabled && !filter.telegram_enabled && (
                                  <span className="px-2 py-0.5 rounded-full bg-glass-medium text-text-muted text-xs flex items-center gap-1 whitespace-nowrap">
                                    <BellOff className="w-3 h-3" />
                                    No alerts
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                                <FilterIcon className="w-4 h-4 text-accent-cyan flex-shrink-0" />
                                <span className="text-text-muted">
                                  {getConditionsCount(filter)} conditions: {getConditionsPreview(filter)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer" onClick={() => setOpenFilterId(isOpen ? null : filter.id)} role="button" tabIndex={0} aria-expanded="false">
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h3 className="text-lg sm:text-xl font-display font-semibold break-words">
                                  {filter.name}
                                </h3>
                                {filter.is_active && (
                                  <span className="px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-xs font-semibold whitespace-nowrap">
                                    ACTIVE
                                  </span>
                                )}
                                {filter.notification_enabled && (
                                  <span className="px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan text-xs flex items-center gap-1 whitespace-nowrap">
                                    <Bell className="w-3 h-3" />
                                    Push
                                  </span>
                                )}
                                {filter.telegram_enabled && (
                                  <span className="px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue text-xs flex items-center gap-1 whitespace-nowrap">
                                    <Send className="w-3 h-3" />
                                    Telegram
                                  </span>
                                )}
                                {!filter.notification_enabled && !filter.telegram_enabled && (
                                  <span className="px-2 py-0.5 rounded-full bg-glass-medium text-text-muted text-xs flex items-center gap-1 whitespace-nowrap">
                                    <BellOff className="w-3 h-3" />
                                    No alerts
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                                <FilterIcon className="w-4 h-4 text-accent-cyan flex-shrink-0" />
                                <span className="text-text-muted">
                                  {getConditionsCount(filter)} conditions: {getConditionsPreview(filter)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                          <button
                            onClick={() => handleToggleNotifications(filter.id, filter.notification_enabled)}
                            className="p-2 rounded-xl hover:bg-glass-light transition-all flex-shrink-0"
                            title={filter.notification_enabled ? 'Disable browser push notifications' : 'Enable browser push notifications'}
                            disabled={updatingNotifications.includes(filter.id)}
                          >
                            {updatingNotifications.includes(filter.id) ? (
                              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            ) : (
                              <Bell className={`w-5 h-5 ${filter.notification_enabled ? 'text-accent-cyan' : 'text-text-muted'}`} />
                            )}
                          </button>

                          <button
                            onClick={() => handleToggleTelegram(filter.id, filter.telegram_enabled)}
                            className="p-2 rounded-xl hover:bg-glass-light transition-all flex-shrink-0"
                            title={filter.telegram_enabled ? 'Disable Telegram notifications' : 'Enable Telegram notifications'}
                            disabled={updatingTelegram.includes(filter.id)}
                          >
                            {updatingTelegram.includes(filter.id) ? (
                              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            ) : (
                              <Send className={`w-5 h-5 ${filter.telegram_enabled ? 'text-accent-blue' : 'text-text-muted'}`} />
                            )}
                          </button>

                          <button
                            onClick={() => handleToggleActive(filter.id, filter.is_active)}
                            className="p-2 rounded-xl hover:bg-glass-light transition-all flex-shrink-0"
                            title={filter.is_active ? 'Disable' : 'Enable'}
                          >
                            {filter.is_active ? (
                              <ToggleRight className="w-5 h-5 text-accent-green" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-text-muted" />
                            )}
                          </button>

                          <button
                            onClick={() => handleEdit(filter.id)}
                            className="p-2 rounded-xl hover:bg-glass-light transition-all flex-shrink-0"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5 text-accent-cyan" />
                          </button>

                          <button
                            onClick={() => handleDelete(filter.id, filter.name)}
                            className="p-2 rounded-xl hover:bg-accent-red/10 text-text-secondary hover:text-accent-red transition-all flex-shrink-0"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="mt-4 pt-4 border-t border-glass-medium"
                          >
                            {filter.description && (
                              <p className="text-text-secondary text-sm mb-3">{filter.description}</p>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-text-muted mb-1">Triggers</p>
                                <p className="text-lg font-semibold">{filter.trigger_count || 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-text-muted mb-1">Success Rate</p>
                                <p className="text-lg font-semibold text-accent-green">
                                  {filter.success_rate ? `${filter.success_rate.toFixed(1)}%` : '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-text-muted mb-1">Last triggered</p>
                                <p className={`text-sm ${!filter.last_triggered ? 'text-accent-yellow' : ''}`}>
                                  {filter.last_triggered ? new Date(filter.last_triggered).toLocaleDateString() : '⚠ Never'}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          
          {/* ========== EMPTY STATE (no filters at all) ========== */}
          {!loading && !error && filters.length === 0 && (
            <div className="glass-card p-12 text-center">
              <FilterIcon className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="text-xl font-display font-semibold mb-2">
                You have no filters yet
              </h3>
              <p className="text-text-secondary mb-6">
                Create your first filter to receive notifications when interesting matches appear!
              </p>
              <button onClick={handleCreateNew} className="btn-primary">
                <Plus className="w-5 h-5 inline mr-2" />
                Create first filter
              </button>
            </div>
          )}

          {/* ========== EMPTY STATE (filter active but no matches) ========== */}
          {!loading && !error && filters.length > 0 && displayedFilters.length === 0 && (
            <div className="glass-card p-10 text-center">
              <FilterIcon className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h3 className="text-lg font-display font-semibold mb-1">
                No filters match &ldquo;{activeStatFilter.replace('_', ' ')}&rdquo;
              </h3>
              <p className="text-text-muted text-sm mb-4">
                None of your {filters.length} filters fall into this category.
              </p>
              <button
                onClick={() => setActiveStatFilter('all')}
                className="text-accent-cyan hover:underline text-sm"
              >
                Show all filters
              </button>
            </div>
          )}
          
          {/* ========== INFO ========== */}
          <div className="glass-card p-4 text-sm">
            <h4 className="font-semibold text-accent-cyan mb-2">
              💡 How do filters work?
            </h4>
            <ul className="space-y-1 text-text-muted">
              <li>• Create filters with custom conditions (corners, shots, cards, etc.)</li>
              <li>• The app scans live matches every 45 seconds</li>
              <li>• <Bell className="w-3 h-3 inline text-accent-cyan" /> Push and <Send className="w-3 h-3 inline text-accent-blue" /> Telegram can be toggled independently per filter</li>
              <li>• If both Push &amp; Telegram are off → no messages will be sent for that filter</li>
              <li>• Deleting a filter removes it from your list — history data &amp; templates are preserved</li>
              <li>• Success rate is calculated automatically from history</li>
            </ul>
          </div>

          {/* ========== MOBILE BULK ACTIONS TOOLBAR ========== */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-3 left-3 right-3 z-50 md:hidden">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg border border-glass-medium">
                <div className="flex-1 text-sm text-text-muted">{selectedIds.length} selected</div>
                <button onClick={() => handleBulkToggleActive(true)} className="px-3 py-2 rounded bg-accent-green text-white text-sm">Activate</button>
                <button onClick={() => handleBulkToggleActive(false)} className="px-3 py-2 rounded bg-glass-medium text-sm">Deactivate</button>
                <button onClick={handleBulkDelete} className="px-3 py-2 rounded bg-accent-red text-white text-sm">Delete</button>
                <button onClick={clearSelection} className="px-2 py-2 rounded bg-transparent text-sm text-text-muted">Clear</button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </AuthWrapper>
  );
}
