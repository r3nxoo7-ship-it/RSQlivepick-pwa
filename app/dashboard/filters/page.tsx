'use client';

// ============================================
// R$Q - FILTERS PAGE (VERSIUNE COMPLETĂ)
// ============================================
// TOATE funcțiile CRUD implementate complet

import { useState, useEffect, useCallback } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
      const userFilters = await dbHelpers.getUserFilters(currentUser.id);
      setFilters(userFilters);
      console.log(`✅ Loaded ${userFilters.length} filters`);
    } catch (err) {
      console.error('❌ Error loading filters:', err);
      setError('Error loading filters');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);
  
  // ============================================
  // HANDLERS - VERSIUNE COMPLETĂ
  // ============================================
  
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
   * Delete filter - IMPLEMENTARE COMPLETĂ
   */
  const handleDelete = async (filterId: string, filterName: string) => {
    // Confirmare
    const confirmed = confirm(`Are you sure you want to delete the filter "${filterName}"?`);
    if (!confirmed) {
      console.log('❌ Delete cancelled by user');
      return;
    }
    
    console.log('🗑️ Deleting filter:', filterId, filterName);
    
    try {
      // Apelăm funcția din supabase.ts
      const { error } = await dbHelpers.deleteFilter(filterId);
      
      if (error) {
        console.error('❌ Delete error:', error);
        alert(`Error: ${error}`);
        return;
      }
      
      console.log('✅ Filter deleted successfully');
      
      // Reload filters to reflect the change
      await loadFilters();
      
    } catch (err) {
      console.error('❌ Exception in handleDelete:', err);
      alert('Error deleting filter');
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
    
    // Cornere
      if (conditions.corners) {
      const c = conditions.corners;
      if (c.min) preview.push(`Corners >${c.min}`);
    }
    
    // Șuturi
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
          
          {/* ========== STATS ========== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-label">Total Filters</div>
              <div className="stat-value">{filters.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active</div>
              <div className="stat-value text-accent-green">
                {filters.filter(f => f.is_active).length}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">With Notifications</div>
              <div className="stat-value text-accent-cyan">
                {filters.filter(f => f.notification_enabled).length}
              </div>
            </div>
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

          {/* ========== ACTIONS TOOLBAR ========== */}
          {!loading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 border border-glass-medium"
            >
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
            </motion.div>
          )}
          
          {/* ========== FILTERS LIST ========== */}
          {!loading && !error && filters.length > 0 && (
            <div className="space-y-4">
              {filters.map((filter, index) => (
                <motion.div
                  key={filter.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    glass-card-hover p-6 
                    border-l-4 
                    ${filter.is_active ? 'border-accent-green' : 'border-glass-medium'}
                  `}
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Nume + Badges */}
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-display font-semibold break-words">
                          {filter.name}
                        </h3>
                        
                        {/* Active badge */}
                        {filter.is_active && (
                          <span className="px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-xs font-semibold whitespace-nowrap">
                            ACTIVE
                          </span>
                        )}
                        
                        {/* Notifications badge */}
                        {filter.notification_enabled && (
                          <span className="px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan text-xs flex items-center gap-1 whitespace-nowrap">
                            <Bell className="w-3 h-3" />
                            Notifications
                          </span>
                        )}
                      </div>
                      
                      {/* Descriere */}
                      {filter.description && (
                        <p className="text-text-secondary text-sm mb-3">
                          {filter.description}
                        </p>
                      )}
                      
                      {/* Condiții preview */}
                      <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                        <FilterIcon className="w-4 h-4 text-accent-cyan flex-shrink-0" />
                        <span className="text-text-muted">
                          {getConditionsCount(filter)} conditions: {getConditionsPreview(filter)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions - responsive layout */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                      {/* Toggle Active */}
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
                      
                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(filter.id)}
                        className="p-2 rounded-xl hover:bg-glass-light transition-all flex-shrink-0"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5 text-accent-cyan" />
                      </button>
                      
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(filter.id, filter.name)}
                        className="p-2 rounded-xl hover:bg-accent-red/10 text-text-secondary hover:text-accent-red transition-all flex-shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-glass-medium">
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
                      <p className="text-sm">
                        {filter.last_triggered 
                          ? new Date(filter.last_triggered).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          
          {/* ========== EMPTY STATE ========== */}
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
          
          {/* ========== INFO ========== */}
          <div className="glass-card p-4 text-sm">
            <h4 className="font-semibold text-accent-cyan mb-2">
              💡 How do filters work?
            </h4>
            <ul className="space-y-1 text-text-muted">
              <li>• Create filters with custom conditions (corners, shots, cards, etc.)</li>
              <li>• The app scans live matches every 45 seconds</li>
              <li>• When a match matches your filter → you receive a notification!</li>
              <li>• You can have multiple active filters at the same time</li>
              <li>• Success rate is calculated automatically from history</li>
            </ul>
          </div>
          
          {/* ========== DEBUG INFO (pentru testing) ========== */}
          <div className="glass-card p-4 text-xs text-text-muted">
            <details>
              <summary className="cursor-pointer font-semibold mb-2">🔧 Debug Info (for developer)</summary>
              <div className="space-y-1 mt-2">
                <p>Total filters loaded: {filters.length}</p>
                <p>Active filters: {filters.filter(f => f.is_active).length}</p>
                <p>Filters with notifications: {filters.filter(f => f.notification_enabled).length}</p>
                <p className="text-accent-cyan mt-2">✅ DELETE and TOGGLE are fully implemented!</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
