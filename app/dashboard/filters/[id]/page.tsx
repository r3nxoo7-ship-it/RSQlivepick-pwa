'use client';

// ============================================
// R$Q - FILTER EDIT PAGE (COMPLETE)
// ============================================
// Edit existing filters with Telegram support

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Trash2,
  Bell,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter, FilterConditions } from '@/lib/supabase';

// ============================================
// MAIN COMPONENT
// ============================================

export default function FilterEditPage() {
  const router = useRouter();
  const params = useParams();
  const filterId = params.id as string;
  
  // ============================================
  // STATE
  // ============================================
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [filter, setFilter] = useState<Filter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    notification_enabled: false,
    telegram_enabled: false,
    conditions: {
      corners: { min: undefined, max: undefined },
      shots_on_target: { min: undefined, max: undefined },
      total_shots: { min: undefined, max: undefined },
      yellow_cards: { min: undefined, max: undefined },
      red_cards: { min: undefined, max: undefined },
      goals: { min: undefined, max: undefined },
      possession: { min: undefined, max: undefined },
      score: { home: undefined, away: undefined, type: 'exact' as const },
      match_time: { min: 1, max: 90 },
    } as FilterConditions,
  });
  
  // ============================================
  // LOAD FILTER
  // ============================================
  
  const loadFilter = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const user = authHelpers.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const filterData = await dbHelpers.getFilterById(filterId);

      if (!filterData) {
        setError('Filter not found');
        return;
      }

      if (filterData.user_id !== user.id) {
        setError('You do not have permission to edit this filter');
        return;
      }

      setFilter(filterData);
      setFormData({
        name: filterData.name,
        description: filterData.description || '',
        is_active: filterData.is_active,
        notification_enabled: filterData.notification_enabled,
        telegram_enabled: filterData.telegram_enabled || false,
        conditions: filterData.conditions,
      });

    } catch (err) {
      console.error('Error loading filter:', err);
      setError('Error loading filter');
    } finally {
      setLoading(false);
    }
  }, [filterId, router]);

  useEffect(() => {
    loadFilter();
  }, [loadFilter]);
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Please enter a name for the filter');
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const user = authHelpers.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      const { data, error } = await dbHelpers.updateFilter(filterId, {
        name: formData.name,
        description: formData.description || null,
        conditions: formData.conditions,
        is_active: formData.is_active,
        notification_enabled: formData.notification_enabled,
        telegram_enabled: formData.telegram_enabled,
      });
      
      if (error) {
        setError(`Error: ${error}`);
        setSaving(false);
        return;
      }

      setSuccess('✅ Filter saved successfully!');
      
      setTimeout(() => {
        router.push('/dashboard/filters');
      }, 1500);
      
    } catch (err: any) {
      console.error('Error saving filter:', err);
      setError(err?.message || 'Error saving filter');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this filter?')) {
      return;
    }
    
    setDeleting(true);
    
    try {
      const { error } = await dbHelpers.deleteFilter(filterId);
      
      if (error) {
        setError(`Error: ${error}`);
        setDeleting(false);
        return;
      }
      
      router.push('/dashboard/filters');
    } catch (err: any) {
      console.error('Error deleting filter:', err);
      setError(err?.message || 'Error deleting filter');
      setDeleting(false);
    }
  };
  
  const updateCondition = (
    category: keyof FilterConditions,
    field: 'min' | 'max',
    value: string
  ) => {
    const numValue = value === '' ? undefined : parseInt(value);
    
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        [category]: {
          ...((formData.conditions as Record<string, any>)[category] || {}),
          [field]: numValue,
        },
      },
    });
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  if (loading) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-accent-cyan mx-auto mb-4" />
            <p className="text-text-secondary">Loading filter...</p>
          </div>
        </div>
      </AuthWrapper>
    );
  }
  
  if (error && !filter) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-accent-red mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error}</h2>
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary mt-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to filters
            </button>
          </div>
        </div>
      </AuthWrapper>
    );
  }
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* ========== HEADER ========== */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button
                onClick={() => router.push('/dashboard/filters')}
                className="btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-display font-bold gradient-text">
                  Edit Filter
                </h1>
                <p className="text-text-secondary text-sm mt-1">
                  Edit filter settings
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary text-accent-red hover:bg-accent-red/10 flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
          
          {/* ========== MESSAGES ========== */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/20 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0" />
              <p className="text-sm text-accent-red">{error}</p>
            </motion.div>
          )}
          
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0" />
              <p className="text-sm text-accent-green">{success}</p>
            </motion.div>
          )}
          
          {/* ========== BASIC INFO ========== */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-display font-semibold mb-4">
              General Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Filter Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Over 9.5 Corners"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Description (optional)
                </label>
                  <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this filter..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-glass-medium checked:bg-accent-cyan"
                  />
                  <div>
                    <p className="font-semibold">Active Filter</p>
                    <p className="text-sm text-text-muted">
                      Scanner will check this filter
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          
          {/* ========== CONDITIONS ========== */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-display font-semibold mb-4">
              Filter Conditions
            </h2>
            
            <div className="space-y-6">
              {/* Corners */}
              <div>
                <h3 className="font-semibold mb-3">⚽ Corners</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Min</label>
                    <input
                      type="number"
                      value={formData.conditions.corners?.min || ''}
                      onChange={(e) => updateCondition('corners', 'min', e.target.value)}
                      placeholder="ex: 8"
                      className="input-field"
                    />
                  </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-2">Max</label>
                    <input
                      type="number"
                      value={formData.conditions.corners?.max || ''}
                      onChange={(e) => updateCondition('corners', 'max', e.target.value)}
                      placeholder="ex: 15"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Shots on Target */}
              <div>
                <h3 className="font-semibold mb-3">🎯 Shots on Target</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Min</label>
                    <input
                      type="number"
                      value={formData.conditions.shots_on_target?.min || ''}
                      onChange={(e) => updateCondition('shots_on_target', 'min', e.target.value)}
                      placeholder="ex: 10"
                      className="input-field"
                    />
                  </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-2">Max</label>
                    <input
                      type="number"
                      value={formData.conditions.shots_on_target?.max || ''}
                      onChange={(e) => updateCondition('shots_on_target', 'max', e.target.value)}
                      placeholder="ex: 20"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Total Shots */}
              <div>
                <h3 className="font-semibold mb-3">⚡ Total Shots</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Min</label>
                    <input
                      type="number"
                      value={formData.conditions.total_shots?.min || ''}
                      onChange={(e) => updateCondition('total_shots', 'min', e.target.value)}
                      placeholder="ex: 15"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Max</label>
                    <input
                      type="number"
                      value={formData.conditions.total_shots?.max || ''}
                      onChange={(e) => updateCondition('total_shots', 'max', e.target.value)}
                      placeholder="ex: 30"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Yellow Cards */}
              <div>
                <h3 className="font-semibold mb-3">🟨 Yellow Cards</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Min</label>
                    <input
                      type="number"
                      value={formData.conditions.yellow_cards?.min || ''}
                      onChange={(e) => updateCondition('yellow_cards', 'min', e.target.value)}
                      placeholder="ex: 3"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Max</label>
                    <input
                      type="number"
                      value={formData.conditions.yellow_cards?.max || ''}
                      onChange={(e) => updateCondition('yellow_cards', 'max', e.target.value)}
                      placeholder="ex: 8"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Match Time */}
              <div>
                <h3 className="font-semibold mb-3">⏱️ Match Time (Minutes)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">From minute</label>
                    <input
                      type="number"
                      value={formData.conditions.match_time?.min || 1}
                      onChange={(e) => updateCondition('match_time', 'min', e.target.value)}
                      placeholder="1"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">To minute</label>
                    <input
                      type="number"
                      value={formData.conditions.match_time?.max || 90}
                      onChange={(e) => updateCondition('match_time', 'max', e.target.value)}
                      placeholder="90"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Red Cards */}
              <div>
                <h3 className="font-semibold mb-3">🔴 Red Cards</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Min</label>
                    <input
                      type="number"
                      value={formData.conditions.red_cards?.min || ''}
                      onChange={(e) => updateCondition('red_cards', 'min', e.target.value)}
                      placeholder="ex: 0"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Max</label>
                    <input
                      type="number"
                      value={formData.conditions.red_cards?.max || ''}
                      onChange={(e) => updateCondition('red_cards', 'max', e.target.value)}
                      placeholder="ex: 3"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Goals */}
              <div>
                <h3 className="font-semibold mb-3">⚽ Goals</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Min</label>
                    <input
                      type="number"
                      value={formData.conditions.goals?.min || ''}
                      onChange={(e) => updateCondition('goals', 'min', e.target.value)}
                      placeholder="ex: 2"
                      className="input-field"
                    />
                  </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-2">Max</label>
                    <input
                      type="number"
                      value={formData.conditions.goals?.max || ''}
                      onChange={(e) => updateCondition('goals', 'max', e.target.value)}
                      placeholder="ex: 5"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Possession */}
              <div>
                <h3 className="font-semibold mb-3">📊 Possession (%)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Min</label>
                    <input
                      type="number"
                      value={formData.conditions.possession?.min || ''}
                      onChange={(e) => updateCondition('possession', 'min', e.target.value)}
                      placeholder="ex: 40"
                      className="input-field"
                    />
                  </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-2">Max</label>
                    <input
                      type="number"
                      value={formData.conditions.possession?.max || ''}
                      onChange={(e) => updateCondition('possession', 'max', e.target.value)}
                      placeholder="ex: 60"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              
              {/* Score (Exact) */}
              <div>
                <h3 className="font-semibold mb-3">🎯 Exact Score</h3>
                <p className="text-xs text-text-muted mb-3">Choose the exact score you are looking for (e.g. 0-0, 1-1, 2-2)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Home Goals</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.conditions.score?.home !== undefined ? formData.conditions.score.home : ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        conditions: {
                          ...formData.conditions,
                          score: {
                            ...formData.conditions.score,
                            home: e.target.value === '' ? undefined : parseInt(e.target.value),
                            type: 'exact',
                          },
                        },
                      })}
                      placeholder="ex: 0"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Away Goals</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.conditions.score?.away !== undefined ? formData.conditions.score.away : ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        conditions: {
                          ...formData.conditions,
                          score: {
                            ...formData.conditions.score,
                            away: e.target.value === '' ? undefined : parseInt(e.target.value),
                            type: 'exact',
                          },
                        },
                      })}
                      placeholder="ex: 0"
                      className="input-field"
                    />
                  </div>
                </div>
                {formData.conditions.score?.home !== undefined && formData.conditions.score?.away !== undefined && (
                  <div className="mt-2 p-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20">
                    <p className="text-xs text-accent-cyan">Target score: <strong>{formData.conditions.score.home}-{formData.conditions.score.away}</strong></p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* ========== NOTIFICATIONS ========== */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent-purple" />
              Notifications
            </h2>
            
            <div className="space-y-3">
              {/* Browser Notifications */}
              <label className="flex items-center gap-3 p-4 rounded-lg bg-glass-light hover:bg-glass-medium transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notification_enabled}
                  onChange={(e) => setFormData({ ...formData, notification_enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-glass-medium checked:bg-accent-cyan"
                />
                <div className="flex-1">
                  <p className="font-semibold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-accent-cyan" />
                    Push Notifications (browser)
                  </p>
                  <p className="text-sm text-text-muted">
                    Receive a browser notification when this filter matches
                  </p>
                </div>
              </label>
              
              {/* Telegram Notifications */}
              <label className="flex items-center gap-3 p-4 rounded-lg bg-glass-light hover:bg-glass-medium transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.telegram_enabled}
                  onChange={(e) => setFormData({ ...formData, telegram_enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-glass-medium checked:bg-accent-purple"
                />
                <div className="flex-1">
                  <p className="font-semibold flex items-center gap-2">
                    <Send className="w-4 h-4 text-accent-purple" />
                    Telegram Notifications
                  </p>
                  <p className="text-sm text-text-muted">
                    Receive an instant alert on Telegram (configure in Settings)
                  </p>
                </div>
              </label>
            </div>
          </div>
          
          {/* ========== ACTIONS ========== */}
            <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
            </button>
          </div>
          
        </div>
      </div>
    </AuthWrapper>
  );
}
