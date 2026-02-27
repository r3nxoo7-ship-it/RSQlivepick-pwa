'use client';

// ============================================
// R$Q - FILTER TEMPLATES PAGE
// ============================================
// Browse and import predefined filter templates

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import templateBgStyles from './templateBackgrounds.module.css';
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
import { validateFilterConditions } from '@/lib/filter-validation';

const TEMPLATE_BG_CLASS_BY_URL: Record<string, string> = {
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80': templateBgStyles.bg1,
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80': templateBgStyles.bg2,
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80': templateBgStyles.bg3,
  'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80': templateBgStyles.bg4,
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80': templateBgStyles.bg5,
  'https://images.unsplash.com/photo-1529079003456-3bac75d7e0e0?w=800&q=80': templateBgStyles.bg6,
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80': templateBgStyles.bg7,
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80': templateBgStyles.bg8,
  'https://images.unsplash.com/photo-1552667466-07770ae110d0?w=800&q=80': templateBgStyles.bg9,
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80': templateBgStyles.bg10,
};

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
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'success' | 'name'>('popular');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  
  // ============================================
  // DATA
  // ============================================
  
  // Only keep templates with coherent/valid conditions and not experimental
  const allTemplates = getAllTemplates().filter(t => {
    if (t.experimental) return false;
    const v = validateFilterConditions(t.conditions);
    return v.isValid;
  });
  const popularTemplates = getPopularTemplates().filter(t => {
    if (t.experimental) return false;
    const v = validateFilterConditions(t.conditions);
    return v.isValid;
  });
  const categoryCounts = getCategoriesWithCounts();
  
  // Let me filter and sort templates based on current selections and sort preference
  let displayedTemplates = selectedCategory === 'all' 
    ? allTemplates 
    : selectedCategory === 'popular'
    ? popularTemplates
    : getTemplatesByCategory(selectedCategory as any);
  
  if (searchQuery) {
    displayedTemplates = displayedTemplates.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Apply sorting
  displayedTemplates = [...displayedTemplates].sort((a, b) => {
    if (sortBy === 'popular') {
      return (b.popularity || 0) - (a.popularity || 0);
    } else if (sortBy === 'success') {
      return (b.successRate || 0) - (a.successRate || 0);
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'recent') {
      // Recent templates would be recent additions - for now, keep original order
      return 0;
    }
    return 0;
  });
  
  // ============================================
  // HANDLERS - MULTI-SELECT
  // ============================================
  
  const toggleSelectTemplate = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const clearTemplateSelection = () => setSelectedTemplates([]);

  const handleImportSelected = async () => {
    if (selectedTemplates.length === 0) {
      alert('Please select at least one template to import');
      return;
    }

    const confirmed = confirm(`Import ${selectedTemplates.length} templates?`);
    if (!confirmed) return;

    setImporting('bulk');
    let successCount = 0;
    let failedCount = 0;

    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        alert('You must be logged in!');
        return;
      }

      for (const templateId of selectedTemplates) {
        const template = allTemplates.find(t => t.id === templateId);
        if (!template) continue;

        try {
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

          if (result.error) {
            failedCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      alert(`✅ Import complete!\nSuccess: ${successCount}, Failed: ${failedCount}`);
      clearTemplateSelection();
      
      // Navigate and refresh
      await router.push('/dashboard/filters');
      setTimeout(() => {
        try {
          router.refresh();
        } catch (e) {
          console.warn('Could not refresh after import:', e);
        }
      }, 500);
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Error importing templates');
    } finally {
      setImporting(null);
    }
  };

  const handleImportAll = async () => {
    if (displayedTemplates.length === 0) {
      alert('No templates to import');
      return;
    }

    const confirmed = confirm(`Import all ${displayedTemplates.length} displayed templates?`);
    if (!confirmed) return;

    setImporting('bulk-all');
    let successCount = 0;
    let failedCount = 0;

    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        alert('You must be logged in!');
        return;
      }

      for (const template of displayedTemplates) {
        try {
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

          if (result.error) {
            failedCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      alert(`✅ Import complete!\nSuccess: ${successCount}, Failed: ${failedCount}`);
      
      // Navigate and refresh
      await router.push('/dashboard/filters');
      setTimeout(() => {
        try {
          router.refresh();
        } catch (e) {
          console.warn('Could not refresh after import:', e);
        }
      }, 500);
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Error importing templates');
    } finally {
      setImporting(null);
    }
  };
  
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
      
      // Create new filter from template
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
        alert(`✅ Filter "${template.name}" successfully imported!\n\nGo to "My Filters" tab to view and activate it.`);
      }

      // Navigate to My Filters, then refresh after a short delay
      await router.push('/dashboard/filters');
      setTimeout(() => {
        try {
          router.refresh();
        } catch (e) {
          console.warn('Could not refresh after import:', e);
        }
      }, 500);
      
    } catch (err) {
      console.error('❌ Import error:', err);
      alert('Error importing filter');
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
      alert('Authentication error: please log in again.');
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
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-2 flex items-center gap-3">
              <div className="text-4xl">📚</div>
              <div>
                <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-accent-cyan to-accent-blue bg-clip-text text-transparent">
                  Filter Templates
                </h1>
              </div>
            </div>
            <p className="text-text-secondary text-lg">
              Choose from <span className="text-accent-cyan font-semibold">{allTemplates.length}+ professional strategies</span> designed by expert analysts. Import with one click and start receiving live alerts.
            </p>
          </motion.div>
          
          {/* ========== SEARCH & FILTER ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="glass-card p-6 border-t border-glass-lighter space-y-4"
          >
            {selectedTemplates.length > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30">
                <div className="text-sm font-semibold text-accent-cyan">
                  {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''} selected
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearTemplateSelection}
                    className="text-xs px-3 py-1.5 rounded-lg text-accent-cyan hover:bg-accent-cyan/20 transition"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={handleImportSelected}
                    disabled={importing === 'bulk'}
                    className="text-xs px-4 py-1.5 rounded-lg bg-accent-cyan text-black font-semibold hover:bg-accent-cyan/90 transition disabled:opacity-50"
                  >
                    {importing === 'bulk' ? 'Importing...' : '📥 Import Selected'}
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent-cyan" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates... (e.g., 'corners', 'multiple goals', 'aggressive')"
                  className="w-full bg-glass-light hover:bg-glass-lighter focus:bg-glass-lighter border border-glass-lighter rounded-xl pl-10 pr-4 py-3 text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 transition"
                />
              </div>
              
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="lg:w-56 bg-glass-light hover:bg-glass-lighter border border-glass-lighter rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 transition font-semibold"
                title="Filter templates by category"
              >
                <option value="all">📊 All Templates ({allTemplates.length})</option>
                <option value="popular">⭐ Popular ({categoryCounts.popular || 0})</option>
                <option value="ml_powered">🤖 AI/ML ({categoryCounts.ml_powered || 0})</option>
                <option value="corners">🎯 Corners ({categoryCounts.corners || 0})</option>
                <option value="shots">🔫 Shots ({categoryCounts.shots || 0})</option>
                <option value="cards">🟨 Cards ({categoryCounts.cards || 0})</option>
                <option value="advanced">✨ Advanced ({categoryCounts.advanced || 0})</option>
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'popular' | 'recent' | 'success' | 'name')}
                className="lg:w-56 bg-glass-light hover:bg-glass-lighter border border-glass-lighter rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 transition font-semibold"
                title="Sort templates"
              >
                <option value="popular">⭐ Most Popular</option>
                <option value="success">✓ Highest Success Rate</option>
                <option value="name">A-Z Alphabetical</option>
                <option value="recent">🆕 Recently Added</option>
              </select>

              {/* Import All Button */}
              {selectedTemplates.length === 0 && displayedTemplates.length > 1 && (
                <button
                  onClick={handleImportAll}
                  disabled={importing === 'bulk-all'}
                  className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-accent-green to-accent-cyan hover:shadow-lg hover:shadow-accent-green/20 text-black transition disabled:opacity-50 whitespace-nowrap"
                  title={`Import all ${displayedTemplates.length} displayed templates`}
                >
                  {importing === 'bulk-all' ? '⏳ Importing...' : `📥 Import All (${displayedTemplates.length})`}
                </button>
              )}
            </div>
          </motion.div>
          
          {/* ========== POPULAR SECTION ========== */}
          {selectedCategory === 'all' && !searchQuery && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-1 bg-gradient-to-r from-accent-amber to-transparent rounded-full" />
                  <TrendingUp className="w-6 h-6 text-accent-amber" />
                  <h2 className="text-2xl font-display font-bold">
                    🔥 Top Popular Strategies
                  </h2>
                  <span className="ml-auto text-sm text-text-secondary font-medium">
                    Most imported this month
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {popularTemplates.slice(0, 3).map((template, index) => {
                  const templateBgClass = template.backgroundImage
                    ? TEMPLATE_BG_CLASS_BY_URL[template.backgroundImage]
                    : undefined;

                  const difficulty = template.tags?.includes('Advanced') ? 'Advanced' : 
                                   template.tags?.includes('Intermediate') ? 'Intermediate' : 
                                   'Beginner';
                  const difficultyColor = difficulty === 'Advanced' ? 'text-accent-purple' : 
                                        difficulty === 'Intermediate' ? 'text-accent-amber' : 
                                        'text-accent-green';
                  
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -4 }}
                      className="group relative"
                    >
                      {/* Checkbox overlay */}
                      <div className="absolute top-3 left-3 z-30 flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(template.id)}
                          onChange={() => toggleSelectTemplate(template.id)}
                          className="w-5 h-5 rounded border border-accent-cyan bg-glass-dark cursor-pointer"
                          title={`Select "${template.name}" for bulk import`}
                        />
                      </div>

                      {/* Background Image */}
                      {templateBgClass && (
                        <>
                          <div
                            className={`absolute inset-0 rounded-2xl opacity-20 group-hover:opacity-30 transition duration-300 bg-cover bg-center ${templateBgClass}`}
                          />
                        </>
                      )}
                      
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-accent-amber/20 via-transparent to-accent-amber/5 opacity-0 group-hover:opacity-100 transition duration-300 rounded-2xl" />
                      
                      <div className="relative glass-card-hover p-6 h-full flex flex-col rounded-2xl border-l-4 border-accent-amber group-hover:border-accent-amber transition">
                        {/* Badge for popular */}
                        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r from-accent-amber/20 to-accent-amber/5 border border-accent-amber/30">
                          <span className="text-xs font-bold text-accent-amber">⭐ #1 Popular</span>
                        </div>
                        
                        {/* Icon and title */}
                        <div className="mb-4">
                          <div className="text-4xl mb-3">{template.icon}</div>
                          <h3 className="text-lg font-display font-bold group-hover:text-accent-amber transition">
                            {template.name}
                          </h3>
                        </div>
                        
                        {/* Description */}
                        <p className="text-sm text-text-secondary mb-4">
                          {template.description}
                        </p>
                        
                        {/* Success and difficulty badges */}
                        <div className="space-y-2 mb-4">
                          {template.successRate && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-accent-green/20 to-accent-green/5 border border-accent-green/30">
                              <TrendingUp className="w-4 h-4 text-accent-green" />
                              <span className="text-sm font-semibold text-accent-green">
                                {template.successRate}% Success
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-4 flex-grow">
                          {template.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="px-2.5 py-1 rounded-lg bg-glass-light text-xs font-medium text-text-secondary border border-glass-lighter"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        
                        {/* Stars and button */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-0.5">
                            {renderStars(template.popularity)}
                          </div>
                          <button
                            onClick={() => handleImport(template)}
                            disabled={importing === template.id}
                            className="py-2 px-4 rounded-lg font-semibold text-sm flex items-center gap-2 transition bg-gradient-to-r from-accent-amber to-accent-orange hover:shadow-lg hover:shadow-accent-amber/20 text-white disabled:opacity-50"
                          >
                            {importing === template.id ? (
                              <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
          
          {/* ========== ALL TEMPLATES ========== */}
          <div className="space-y-8">
            {!searchQuery && selectedCategory === 'all' && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-1 bg-gradient-to-r from-accent-cyan to-transparent rounded-full" />
                  <FilterIcon className="w-5 h-5 text-accent-cyan" />
                  <h2 className="text-2xl font-display font-bold">
                    Filter Templates
                  </h2>
                  <span className="ml-auto text-sm text-text-secondary font-medium">
                    {displayedTemplates.length} templates
                  </span>
                </div>
                <p className="text-text-secondary text-sm">
                  Choose from professional templates or create your own strategy
                </p>
              </div>
            )}
            
            {searchQuery && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Search className="w-5 h-5 text-accent-cyan" />
                  <h2 className="text-2xl font-display font-bold">
                    Search Results
                  </h2>
                  <span className="ml-auto text-sm text-text-secondary font-medium">
                    {displayedTemplates.length} match{displayedTemplates.length !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>
            )}
            
            {displayedTemplates.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-12 text-center border-l-4 border-accent-cyan"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Search className="w-10 h-10 text-accent-cyan" />
                </div>
                <h3 className="text-xl font-display font-semibold mb-2">
                  No matching templates
                </h3>
                <p className="text-text-secondary mb-4">
                  Try a different search term or category
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="text-accent-cyan hover:text-accent-cyan/80 transition text-sm font-semibold"
                >
                  Reset filters →
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedTemplates.map((template, index) => {
                  const CategoryIcon = getCategoryIcon(template.category);
                  const categoryColor = getCategoryColor(template.category);
                  const difficulty = template.tags?.includes('Advanced') ? 'Advanced' : 
                                   template.tags?.includes('Intermediate') ? 'Intermediate' : 
                                   'Beginner';
                  const difficultyColor = difficulty === 'Advanced' ? 'text-accent-purple' : 
                                        difficulty === 'Intermediate' ? 'text-accent-amber' : 
                                        'text-accent-green';
                  
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -4 }}
                      className="group relative"
                    >
                      {/* Checkbox overlay */}
                      <div className="absolute top-3 left-3 z-30 flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(template.id)}
                          onChange={() => toggleSelectTemplate(template.id)}
                          className="w-5 h-5 rounded border border-accent-cyan bg-glass-dark cursor-pointer"
                          title={`Select "${template.name}" for bulk import`}
                        />
                      </div>

                      {/* Gradient background on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/10 via-transparent to-accent-purple/5 opacity-0 group-hover:opacity-100 transition duration-300 rounded-2xl" />
                      
                      <div className="relative glass-card-hover p-6 h-full flex flex-col rounded-2xl border-l-4 border-transparent group-hover:border-accent-cyan transition duration-300">
                        {/* Header with icon and popularity */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">{template.icon}</div>
                            <div>
                              <div className={`text-xs font-semibold uppercase tracking-wider ${categoryColor} mb-1`}>
                                {template.category}
                              </div>
                              <CategoryIcon className={`w-4 h-4 ${categoryColor}`} />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {renderStars(template.popularity)}
                          </div>
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-lg font-display font-bold mb-2 group-hover:text-accent-cyan transition">
                          {template.name}
                        </h3>
                        
                        {/* Description */}
                        <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                          {template.description}
                        </p>
                        
                        {/* Success Rate Badge */}
                        {template.successRate && (
                          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-gradient-to-r from-accent-green/20 to-accent-green/5 border border-accent-green/30">
                            <TrendingUp className="w-4 h-4 text-accent-green" />
                            <span className="text-sm font-semibold text-accent-green">
                              {template.successRate}% Success Rate
                            </span>
                          </div>
                        )}
                        
                        {/* Difficulty Level */}
                        <div className="inline-flex items-center gap-2 mb-4">
                          <span className={`text-xs font-semibold ${difficultyColor} uppercase tracking-wider`}>
                            {difficulty} Level
                          </span>
                        </div>
                        
                        {/* Condition Tags */}
                        <div className="flex flex-wrap gap-2 mb-4 flex-grow">
                          {template.tags.slice(0, 4).map((tag, i) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg bg-glass-light hover:bg-glass-lighter transition text-xs font-medium text-text-secondary border border-glass-lighter"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan mr-1.5" />
                              {tag}
                            </span>
                          ))}
                          {template.tags.length > 4 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-glass-light/50 text-xs font-medium text-text-muted">
                              +{template.tags.length - 4} more
                            </span>
                          )}
                        </div>
                        
                        {/* Import Button */}
                        <button
                          onClick={() => handleImport(template)}
                          disabled={importing === template.id}
                          className="mt-auto w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition duration-300 bg-gradient-to-r from-accent-cyan to-accent-blue hover:shadow-lg hover:shadow-accent-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                        >
                          {importing === template.id ? (
                            <>
                              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Import Template
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* ========== INFO SECTION ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-8 border-l-4 border-accent-cyan"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">💡</div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-lg text-accent-cyan mb-3">
                  How It Works
                </h3>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex gap-3">
                    <span className="text-accent-cyan font-bold">1.</span>
                    <span>Browse templates below and select filters that match your strategy</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent-cyan font-bold">2.</span>
                    <span>Click &quot;Import Template&quot; and the filter is instantly added to your collection</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent-cyan font-bold">3.</span>
                    <span>Customize and enable notifications - start receiving live alerts</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent-cyan font-bold">4.</span>
                    <span>Track success rate and refine your filters based on performance metrics</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
          
          {/* ========== NAVIGATION ========== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex gap-4 flex-col sm:flex-row"
          >
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="flex-1 py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition duration-300 bg-glass-light hover:bg-glass-lighter border border-glass-lighter text-text-primary"
            >
              ← Back to My Filters
            </button>
            <button
              onClick={() => router.push('/dashboard/filters/new')}
              className="flex-1 py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition duration-300 bg-gradient-to-r from-accent-purple to-accent-blue hover:shadow-lg hover:shadow-accent-purple/20 text-white"
            >
              ✨ Create Custom Filter
            </button>
          </motion.div>
        </div>
      </div>
    </AuthWrapper>
  );
}
