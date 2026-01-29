'use client';

// ============================================
// R$Q - FILTER TEMPLATES PAGE
// ============================================
// Browse and import predefined filter templates

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Star,
  Download,
  Search,
  Filter as FilterIcon,
  TrendingUp,
  Clock,
  Award,
  Zap,
  Target,
  Shield,
  Sparkles,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import { 
  getAllTemplates, 
  getTemplatesByCategory, 
  getPopularTemplates,
  searchTemplates,
  getCategoriesWithCounts,
  type FilterTemplate 
} from '@/lib/filter-templates';

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function FilterTemplatesPage() {
  const router = useRouter();
  
  // ============================================
  // STATE
  // ============================================
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState<string>('https://livepick.eu/filters.json');
  const [lastImportResult, setLastImportResult] = useState<{ success: number; failed: number } | null>(null);
  
  // ============================================
  // DATA
  // ============================================
  
  const allTemplates = getAllTemplates();
  const popularTemplates = getPopularTemplates();
  const categoryCounts = getCategoriesWithCounts();
  
  // Filter templates based on category and search
  let displayedTemplates = selectedCategory === 'all' 
    ? allTemplates 
    : selectedCategory === 'popular'
    ? popularTemplates
    : getTemplatesByCategory(selectedCategory as any);
  
  if (searchQuery) {
    displayedTemplates = searchTemplates(searchQuery);
  }
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleImport = async (template: FilterTemplate) => {
    setImporting(template.id);
    
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        alert('You must be logged in!');
        router.push('/login');
        return;
      }
      
      // Validate user has proper UUID
      if (!currentUser.id || currentUser.id === 'anon' || typeof currentUser.id !== 'string' || currentUser.id.length === 0) {
        alert('Authentication error: please log in again.');
        localStorage.removeItem('rsq_user');
        router.push('/login');
        return;
      }
      
      console.log('📥 Importing template:', template.name);
      
      // Creează filtru nou din template
      const result = await dbHelpers.createFilter({
        user_id: currentUser?.id || undefined,
        name: template.name,
        description: template.description,
        conditions: template.conditions as any,
        is_active: true,
        notification_enabled: template.notificationEnabled && template.category !== 'experimental',
        telegram_enabled: false,
        is_shared: false,
        trigger_count: 0,
        success_rate: null,
      });
      
      const { data, error } = result;
      
      if (error) {
        // Manejar error de duplicado
        if (error.includes('Duplicate filter') || error.includes('duplicado')) {
          alert(`⚠️ ${error}\n\nConsejo: Puedes renombrar el filtro o cambiar sus condiciones para importarlo nuevamente.`);
        } else if (error.includes('Complete') || error.includes('completa')) {
          alert(`⚠️ ${error}\n\nNota: El filtro ha sido importado pero sin notificaciones. Completa las condiciones para activarlas.`);
        } else {
          alert(`Error: ${error}`);
        }
        return;
      }
      
      console.log('✅ Template imported:', data);
      
      // Success message with experimental warning
      if (template.experimental) {
        alert(`✅ Experimental filter "${template.name}" imported!\n\n🧪 This is a test version — monitor results and adjust your strategy.`);
      } else {
        alert(`✅ Filter "${template.name}" successfully imported!`);
      }
      
      // Reload templates page to show updated list
      router.refresh();
      
    } catch (err) {
      console.error('❌ Import error:', err);
      alert('Eroare la importarea filtrului');
    } finally {
      setImporting(null);
    }
  };

  const handleImportFromUrl = async () => {
    const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
      alert('You must be logged in!');
      router.push('/login');
      return;
    }
    
    // Validate user has proper UUID
    if (!currentUser.id || currentUser.id === 'anon' || typeof currentUser.id !== 'string' || currentUser.id.length === 0) {
      alert('Eroare de autentificare: Vă rugăm să vă relogați.');
      localStorage.removeItem('rsq_user');
      router.push('/login');
      return;
    }

      if (!importUrl) {
      alert('Enter a valid import URL');
      return;
    }

    try {
      setImporting('bulk');
      setLastImportResult(null);

      const res = await fetch(importUrl);
      if (!res.ok) throw new Error(`Could not fetch ${importUrl}: ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data)) {
        alert('Source JSON must be an array of templates');
        return;
      }

      // Send to server-side import route which validates and upserts
      const importRes = await fetch('/api/filters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: data, userId: currentUser.id }),
      });

      const importJson = await importRes.json();

      if (!importRes.ok) {
        console.error('Server import error:', importJson);
        alert('Server-side import error: ' + (importJson.error || importJson));
        return;
      }

      setLastImportResult({ success: importJson.success || 0, failed: importJson.failed || 0 });
      alert(`Import complete — success: ${importJson.success || 0}, failed: ${importJson.failed || 0}`);
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Error importing filters');
    } finally {
      setImporting(null);
    }
  };
  
  // ============================================
  // RENDER HELPERS
  // ============================================
  
  const renderStars = (count: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < count ? 'fill-accent-amber text-accent-amber' : 'text-glass-medium'
            }`}
          />
        ))}
      </div>
    );
  };
  
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      popular: TrendingUp,
      corners: Target,
      cards: Zap,
      shots: Award,
      advanced: Sparkles,
      goals: FilterIcon,
    };
    return icons[category] || FilterIcon;
  };
  
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      popular: 'text-accent-amber',
      corners: 'text-accent-cyan',
      cards: 'text-accent-red',
      shots: 'text-accent-green',
      advanced: 'text-accent-purple',
      goals: 'text-accent-blue',
    };
    return colors[category] || 'text-accent-cyan';
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* ========== HEADER ========== */}
          <div>
            <h1 className="text-3xl font-display font-bold gradient-text mb-2">
              📚 Filter Templates
            </h1>
            <p className="text-text-secondary">
              Filtre profesionale gata făcute - importă cu un click!
            </p>
          </div>
          
          {/* ========== SEARCH & FILTER ========== */}
          <div className="glass-card p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Caută filtre... (ex: corners, cards, aggressive)"
                  className="input-field pl-10"
                />
              </div>
              
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field md:w-48"
              >
                <option value="all">Toate ({allTemplates.length})</option>
                <option value="popular">⭐ Popular ({categoryCounts.popular || 0})</option>
                <option value="corners">🎯 Cornere ({categoryCounts.corners || 0})</option>
                <option value="shots">🎯 Șuturi ({categoryCounts.shots || 0})</option>
                <option value="cards">🟨 Cartonașe ({categoryCounts.cards || 0})</option>
                <option value="advanced">✨ Avansate ({categoryCounts.advanced || 0})</option>
              </select>
            </div>
          </div>
          
          {/* ========== POPULAR SECTION ========== */}
          {selectedCategory === 'all' && !searchQuery && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent-amber" />
                <h2 className="text-xl font-display font-semibold">
                  🔥 Cele mai populare
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {popularTemplates.slice(0, 3).map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass-card-hover p-6 border-l-4 border-accent-amber"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-3xl">{template.icon}</div>
                      {renderStars(template.popularity)}
                    </div>
                    
                    <h3 className="text-lg font-display font-semibold mb-2">
                      {template.name}
                    </h3>
                    
                    <p className="text-sm text-text-secondary mb-3">
                      {template.description}
                    </p>
                    
                    {template.successRate && (
                      <div className="flex items-center gap-2 mb-3 text-sm">
                        <TrendingUp className="w-4 h-4 text-accent-green" />
                        <span className="text-accent-green font-semibold">
                          {template.successRate}% Success Rate
                        </span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-glass-light text-xs text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => handleImport(template)}
                      disabled={importing === template.id}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {importing === template.id ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Se importă...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Importă Filtru
                        </>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          
          {/* ========== ALL TEMPLATES ========== */}
          <div className="space-y-4">
            {!searchQuery && selectedCategory === 'all' && (
              <div className="flex items-center gap-2">
                <FilterIcon className="w-5 h-5 text-accent-cyan" />
                <h2 className="text-xl font-display font-semibold">
                  Toate filtrele ({displayedTemplates.length})
                </h2>
              </div>
            )}
            
            {searchQuery && (
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-accent-cyan" />
                <h2 className="text-xl font-display font-semibold">
                  Rezultate căutare: {displayedTemplates.length}
                </h2>
              </div>
            )}
            
            {displayedTemplates.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Search className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <h3 className="text-xl font-display font-semibold mb-2">
                  Nu am găsit filtre
                </h3>
                <p className="text-text-secondary">
                  Încearcă alt termen de căutare sau categorie
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedTemplates.map((template, index) => {
                  const CategoryIcon = getCategoryIcon(template.category);
                  const categoryColor = getCategoryColor(template.category);
                  
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="glass-card-hover p-6"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{template.icon}</span>
                          <CategoryIcon className={`w-4 h-4 ${categoryColor}`} />
                        </div>
                        {renderStars(template.popularity)}
                      </div>
                      
                      <h3 className="text-lg font-display font-semibold mb-2">
                        {template.name}
                      </h3>
                      
                      <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                        {template.description}
                      </p>
                      
                      {template.successRate && (
                        <div className="flex items-center gap-2 mb-3 text-sm">
                          <TrendingUp className="w-4 h-4 text-accent-green" />
                          <span className="text-accent-green font-semibold">
                            {template.successRate}%
                          </span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-1 mb-4">
                        {template.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-glass-light text-xs text-text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => handleImport(template)}
                        disabled={importing === template.id}
                        className="btn-secondary w-full flex items-center justify-center gap-2"
                      >
                        {importing === template.id ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
                            Se importă...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Importă
                          </>
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* ========== INFO ========== */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-accent-cyan mb-3">
              💡 Cum funcționează?
            </h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>• Browse template-urile și alege pe cele care ți se potrivesc</li>
              <li>• Click &quot;Importă&quot; - filtrul se adaugă instant în Filtrele Tale</li>
              <li>• Template-ul devine filtrul tău - îl poți modifica oricând</li>
              <li>• Notificările se activează automat pentru filtre populare</li>
              <li>• Success Rate e bazat pe performanța istorică (când e disponibil)</li>
            </ul>
          </div>
          
          {/* ========== NAVIGATION ========== */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary"
            >
              ← View My Filters
            </button>
            <button
              onClick={() => router.push('/dashboard/filters/new')}
              className="btn-primary"
            >
              ✨ Creează Filtru Custom
            </button>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
