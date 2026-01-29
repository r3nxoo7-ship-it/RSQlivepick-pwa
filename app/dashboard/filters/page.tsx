'use client';

// ============================================
// R$Q - FILTERS PAGE (VERSIUNE COMPLETĂ)
// ============================================
// TOATE funcțiile CRUD implementate complet

import { useState, useEffect } from 'react';
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
  
  useEffect(() => {
    loadFilters();
  }, []);
  
  const loadFilters = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Obținem user-ul curent
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      
      // Încărcăm filtrele
      console.log('🔍 Loading filters for user:', currentUser.id);
      const userFilters = await dbHelpers.getUserFilters(currentUser.id);
      setFilters(userFilters);
      
      console.log(`✅ Loaded ${userFilters.length} filters`);
    } catch (err) {
      console.error('❌ Error loading filters:', err);
      setError('Eroare la încărcarea filtrelor');
    } finally {
      setLoading(false);
    }
  };
  
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
        alert(`Eroare: ${error}`);
        return;
      }
      
      console.log('✅ Filter toggled successfully:', data);
      
      // Reîncarcă filtrele pentru a reflecta schimbarea
      await loadFilters();
      
    } catch (err) {
      console.error('❌ Exception in handleToggleActive:', err);
      alert('Eroare la schimbarea statusului');
    }
  };
  
  /**
   * Delete filter - IMPLEMENTARE COMPLETĂ
   */
  const handleDelete = async (filterId: string, filterName: string) => {
    // Confirmare
    const confirmed = confirm(`Sigur vrei să ștergi filtrul "${filterName}"?`);
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
        alert(`Eroare: ${error}`);
        return;
      }
      
      console.log('✅ Filter deleted successfully');
      
      // Reîncarcă filtrele pentru a reflecta schimbarea
      await loadFilters();
      
    } catch (err) {
      console.error('❌ Exception in handleDelete:', err);
      alert('Eroare la ștergerea filtrului');
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
   * Returnează numărul de condiții dintr-un filtru
   */
  const getConditionsCount = (filter: Filter): number => {
    return Object.keys(filter.conditions).length;
  };
  
  /**
   * Returnează un preview text al condițiilor
   */
  const getConditionsPreview = (filter: Filter): string => {
    const conditions = filter.conditions;
    const preview: string[] = [];
    
    // Cornere
    if (conditions.corners) {
      const c = conditions.corners;
      if (c.min) preview.push(`Cornere >${c.min}`);
    }
    
    // Șuturi
    if (conditions.shots_on_target?.min) {
      preview.push(`Șuturi >${conditions.shots_on_target.min}`);
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
                🎯 Filtrele Mele
              </h1>
              <p className="text-text-secondary">
                Creează și gestionează filtre personalizate pentru meciuri
              </p>
            </div>
            
            <div className="flex gap-3">
              {/* Browse Templates Button */}
              <button
                onClick={() => router.push('/dashboard/filters/templates')}
                className="btn-secondary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Templates
              </button>
              
              {/* Buton Create New */}
              <button
                onClick={handleCreateNew}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Filtru Nou
              </button>
            </div>
          </div>
          
          {/* ========== STATS ========== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-label">Total Filtre</div>
              <div className="stat-value">{filters.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active</div>
              <div className="stat-value text-accent-green">
                {filters.filter(f => f.is_active).length}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cu Notificări</div>
              <div className="stat-value text-accent-cyan">
                {filters.filter(f => f.notification_enabled).length}
              </div>
            </div>
          </div>
          
          {/* ========== LOADING ========== */}
          {loading && (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-text-secondary">Se încarcă filtrele...</p>
            </div>
          )}
          
          {/* ========== ERROR ========== */}
          {error && (
            <div className="glass-card p-6 border-l-4 border-accent-red">
              <h3 className="text-accent-red font-semibold mb-2">❌ Eroare</h3>
              <p className="text-text-secondary text-sm">{error}</p>
            </div>
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
                            ACTIV
                          </span>
                        )}
                        
                        {/* Notifications badge */}
                        {filter.notification_enabled && (
                          <span className="px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan text-xs flex items-center gap-1 whitespace-nowrap">
                            <Bell className="w-3 h-3" />
                            Notificări
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
                          {getConditionsCount(filter)} condiții: {getConditionsPreview(filter)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions - responsive layout */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                      {/* Toggle Active */}
                      <button
                        onClick={() => handleToggleActive(filter.id, filter.is_active)}
                        className="p-2 rounded-xl hover:bg-glass-light transition-all flex-shrink-0"
                        title={filter.is_active ? 'Dezactivează' : 'Activează'}
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
                        title="Editează"
                      >
                        <Edit className="w-5 h-5 text-accent-cyan" />
                      </button>
                      
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(filter.id, filter.name)}
                        className="p-2 rounded-xl hover:bg-accent-red/10 text-text-secondary hover:text-accent-red transition-all flex-shrink-0"
                        title="Șterge"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-glass-medium">
                    <div>
                      <p className="text-xs text-text-muted mb-1">Declanșări</p>
                      <p className="text-lg font-semibold">{filter.trigger_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted mb-1">Success Rate</p>
                      <p className="text-lg font-semibold text-accent-green">
                        {filter.success_rate ? `${filter.success_rate.toFixed(1)}%` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted mb-1">Ultima dată</p>
                      <p className="text-sm">
                        {filter.last_triggered 
                          ? new Date(filter.last_triggered).toLocaleDateString('ro-RO')
                          : 'Niciodată'}
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
                Nu ai filtre create încă
              </h3>
              <p className="text-text-secondary mb-6">
                Creează primul tău filtru pentru a primi notificări când apar meciuri interesante!
              </p>
              <button onClick={handleCreateNew} className="btn-primary">
                <Plus className="w-5 h-5 inline mr-2" />
                Creează primul filtru
              </button>
            </div>
          )}
          
          {/* ========== INFO ========== */}
          <div className="glass-card p-4 text-sm">
            <h4 className="font-semibold text-accent-cyan mb-2">
              💡 Cum funcționează filtrele?
            </h4>
            <ul className="space-y-1 text-text-muted">
              <li>• Creează filtre cu condiții personalizate (cornere, șuturi, cards, etc.)</li>
              <li>• Aplicația scanează meciurile live la fiecare 45 secunde</li>
              <li>• Când un meci match-uiește filtrul → primești notificare!</li>
              <li>• Poți avea filtre multiple active simultan</li>
              <li>• Success rate se calculează automat din istoric</li>
            </ul>
          </div>
          
          {/* ========== DEBUG INFO (pentru testing) ========== */}
          <div className="glass-card p-4 text-xs text-text-muted">
            <details>
              <summary className="cursor-pointer font-semibold mb-2">🔧 Debug Info (pentru developer)</summary>
              <div className="space-y-1 mt-2">
                <p>Total filters loaded: {filters.length}</p>
                <p>Active filters: {filters.filter(f => f.is_active).length}</p>
                <p>Filters with notifications: {filters.filter(f => f.notification_enabled).length}</p>
                <p className="text-accent-cyan mt-2">✅ DELETE și TOGGLE sunt implementate complet!</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
