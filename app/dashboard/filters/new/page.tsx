'use client';

// ============================================
// R$Q - COMPLETE FILTER BUILDER UI
// ============================================
// Comprehensive filter creation with all conditions

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Save,
  ArrowLeft,
  Plus,
  Minus,
  Clock,
  Target,
  Users,
  Shield,
  Activity,
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Combine,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import { ExtendedFilterConditions } from '@/lib/extended-filters';
export default function NewFilterPage() {
  // MAIN CONTENT
    return (<>
      {showCombineMode ? (
            <div className="space-y-6">
              {/* Minimal info for Super Filter */}
              <div className="glass-card p-6">
                <h2 className="text-xl font-semibold mb-4">Create Super Filter</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Filter Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Combined: Corners + 0-0"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Description (optional)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe this super filter (optional)"
                      rows={2}
                      className="input-field resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Combine UI (existing filters) */}
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                  <Combine className="w-5 h-5" />
                  Combine Filters
                </h3>

                {userFilters && userFilters.length > 0 ? (
                  <>
                    <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/30">
                      <label className="block text-sm font-medium text-gray-300 mb-3">Combination Logic</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="logic"
                            value="AND"
                            checked={combinationLogic === 'AND'}
                            onChange={(e) => setCombinationLogic(e.target.value as 'AND' | 'OR')}
                            className="w-4 h-4 accent-cyan-400"
                          />
                          <span className="text-gray-300"><strong>AND</strong> - all selected filters must match</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="logic"
                            value="OR"
                            checked={combinationLogic === 'OR'}
                            onChange={(e) => setCombinationLogic(e.target.value as 'AND' | 'OR')}
                            className="w-4 h-4 accent-purple-400"
                          />
                          <span className="text-gray-300"><strong>OR</strong> - any selected filter can match</span>
                        </label>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-3">Select filters to combine ({combinedFilterIds.length}/5)</label>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {userFilters.map((filter) => (
                          <label
                            key={filter.id}
                            className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-cyan-500/50 transition-colors cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={combinedFilterIds.includes(filter.id)}
                              onChange={(e) => {
                                if (e.target.checked && combinedFilterIds.length < 5) {
                                  setCombinedFilterIds([...combinedFilterIds, filter.id]);
                                } else if (!e.target.checked) {
                                  setCombinedFilterIds(combinedFilterIds.filter((id) => id !== filter.id));
                                }
                              }}
                              disabled={!combinedFilterIds.includes(filter.id) && combinedFilterIds.length >= 5}
                              className="w-4 h-4 accent-cyan-400 mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-100 font-medium truncate">{filter.name}</p>
                              <p className="text-xs text-gray-400">{Object.keys(filter.conditions || {}).length} conditions</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {combinedFilterIds.length > 0 && (
                      <div className="mt-4 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
                        <p className="text-sm text-cyan-300">Combining <strong>{combinedFilterIds.length}</strong> filter{combinedFilterIds.length !== 1 ? 's' : ''} with <strong>{combinationLogic}</strong> logic.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-6 text-gray-400">
                    <p>No existing filters available for combining</p>
                    <p className="text-xs mt-2">Create filters first, then combine them here</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ORIGINAL FULL UI (unchanged) */}
              <div className="glass-card p-6">
                <h2 className="text-xl font-semibold mb-4">General Information</h2>
              
                <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-semibold mb-2">
                      Filter Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ex: Corners + Score 0-0"
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe this filter..."
                      rows={2}
                      className="input-field resize-none"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-sm">Active Filter</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationEnabled}
                        onChange={(e) => setNotificationEnabled(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-sm">Browser Notifications</span>
                    </label>
                    
                      <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={telegramEnabled}
                        onChange={(e) => setTelegramEnabled(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-sm">Telegram</span>
                    </label>
                  </div>
                </div>
              </div>
              <p className="text-text-secondary text-sm mt-1">
                All available conditions
              </p>
            </div>
          </div>
          
          {/* MESSAGES */}
          {error && (
            <div className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/20 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-accent-red" />
              <p className="text-sm text-accent-red">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="p-4 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-accent-green" />
              <p className="text-sm text-accent-green">{success}</p>
            </div>
          )}
          
          {/* BASIC INFO */}
          <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">General Information</h2>
            
            <div className="space-y-4">
              <div>
                  <label className="block text-sm font-semibold mb-2">
                  Filter Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Corners + Score 0-0"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this filter..."
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Active Filter</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationEnabled}
                    onChange={(e) => setNotificationEnabled(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Browser Notifications</span>
                </label>
                
                  <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Telegram</span>
                </label>
              </div>
            </div>
          </div>

          {/* PRE-MATCH ODDS */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-accent-amber" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/></svg>
                <h3 className="text-lg font-semibold">Pre-match Odds Filter</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={oddsEnabled}
                  onChange={(e) => setOddsEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>

            {oddsEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-2">Min Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={oddsMin ?? ''}
                    onChange={(e) => setOddsMin(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g. 1.5"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Max Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={oddsMax ?? ''}
                    onChange={(e) => setOddsMax(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g. 3.0"
                    className="input-field"
                  />
                </div>
                <div className="col-span-2 text-xs text-text-muted">
                  Example: For +3 goals strategies set Max Odds &lt;= 1.8 to only consider matches that opened below 1.8. For red-card-only signals set Min Odds &gt;= 6 to focus on long-shot events.
                </div>
              </div>
            )}
          </div>
          
          {/* TIME CONDITIONS */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-accent-amber" />
                <h3 className="text-lg font-semibold">Match Time (minutes)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeEnabled}
                  onChange={(e) => setTimeEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            
            {timeEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Time Mode</label>
                  <select
                    value={timeMode}
                    onChange={(e) => setTimeMode(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="after">After minute...</option>
                      <option value="before">Before minute...</option>
                      <option value="between">Between minutes...</option>
                  </select>
                </div>
                
                {timeMode === 'between' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="From min"
                      value={timeValue.min}
                      onChange={(e) => setTimeValue({ ...timeValue, min: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={90}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="To min"
                      value={timeValue.max}
                      onChange={(e) => setTimeValue({ ...timeValue, max: parseInt(e.target.value) || 90 })}
                      min={1}
                      max={90}
                      className="input-field"
                    />
                  </div>
                ) : (
                  <input
                    type="number"
                    placeholder={timeMode === 'after' ? "After minute..." : "Before minute..."}
                    value={timeMode === 'after' ? timeValue.min : timeValue.max}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setTimeValue(timeMode === 'after' ? { ...timeValue, min: val } : { ...timeValue, max: val });
                    }}
                    min={1}
                    max={90}
                    className="input-field"
                  />
                )}
              </div>
            )}
          </div>
          
          {/* SCORE CONDITIONS */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-accent-green" />
                <h3 className="text-lg font-semibold">Score</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scoreEnabled}
                  onChange={(e) => setScoreEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            
            {scoreEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Score Mode</label>
                  <select
                    value={scoreMode}
                    onChange={(e) => setScoreMode(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="exact">Exact Score (ex: 0-0, 1-0)</option>
                    <option value="range">Range (min/max goals)</option>
                  </select>
                </div>
                
                {scoreMode === 'exact' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-2">Home Goals</label>
                      <input
                        type="number"
                        value={exactScore.home}
                        onChange={(e) => setExactScore({ ...exactScore, home: parseInt(e.target.value) || 0 })}
                        min={0}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2">Away Goals</label>
                      <input
                        type="number"
                        value={exactScore.away}
                        onChange={(e) => setExactScore({ ...exactScore, away: parseInt(e.target.value) || 0 })}
                        min={0}
                        className="input-field"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-green">
                        🏠 Home Goals
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Min"
                          value={scoreRange.home_min || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            home_min: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={scoreRange.home_max || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            home_max: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-cyan">
                        🚌 Away Goals
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Min"
                          value={scoreRange.away_min || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            away_min: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={scoreRange.away_max || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            away_max: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-purple">
                        📊 Match Total Goals
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Min (ex: 3 pentru Over 2.5)"
                          value={scoreRange.total_min || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            total_min: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={scoreRange.total_max || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            total_max: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* STATISTICS CONDITIONS */}
          <div className="space-y-6">
            {renderTeamCondition(
              'Corners',
              cornersEnabled,
              setCornersEnabled,
              corners,
              setCorners,
              <Activity className="w-5 h-5 text-accent-cyan" />
            )}
            
            {renderTeamCondition(
              'Shots',
              shotsEnabled,
              setShotsEnabled,
              shots,
              setShots,
              <Target className="w-5 h-5 text-accent-green" />
            )}
            
            {renderTeamCondition(
              'Shots on Target',
              shotsOnTargetEnabled,
              setShotsOnTargetEnabled,
              shotsOnTarget,
              setShotsOnTarget,
              <Target className="w-5 h-5 text-accent-purple" />
            )}
            
            {renderTeamCondition(
              'Yellow Cards',
              yellowCardsEnabled,
              setYellowCardsEnabled,
              yellowCards,
              setYellowCards,
              <div className="w-5 h-5 bg-yellow-500 rounded" />
            )}
            
            {renderTeamCondition(
              'Red Cards 🔴',
              redCardsEnabled,
              setRedCardsEnabled,
              redCards,
              setRedCards,
              <div className="w-5 h-5 bg-red-500 rounded" />
            )}
            
            {renderTeamCondition(
              'Dangerous Attacks',
              attacksEnabled,
              setAttacksEnabled,
              attacks,
              setAttacks,
              <TrendingUp className="w-5 h-5 text-accent-amber" />
            )}
            
            {renderTeamCondition(
              'Schimbări (Substitutions)',
              substitutionsEnabled,
              setSubstitutionsEnabled,
              substitutions,
              setSubstitutions,
              <Users className="w-5 h-5 text-accent-cyan" />
            )}
          </div>
          
          {/* POSSESSION */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent-purple" />
                <h3 className="text-lg font-semibold">Possession (%)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={possessionEnabled}
                  onChange={(e) => setPossessionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            
            {possessionEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-accent-green">
                    🏠 Home Possession (%)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={possession.home_min || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        home_min: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Max %"
                      value={possession.home_max || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        home_max: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-2 text-accent-cyan">
                    🚌 Away Possession (%)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={possession.away_min || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        away_min: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Max %"
                      value={possession.away_max || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        away_max: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {showCombineMode && (
            <div className="space-y-4 pb-6">
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                  <Combine className="w-5 h-5" />
                  Combine Filters
                </h3>
                
                {userFilters && userFilters.length > 0 ? (
                  <>
                    {/* Combination Logic Selection */}
                    <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/30">
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        How should filters be combined?
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name="logic"
                            value="AND"
                            checked={combinationLogic === 'AND'}
                            onChange={(e) => setCombinationLogic(e.target.value as 'AND' | 'OR')}
                            className="w-4 h-4 accent-cyan-400"
                          />
                          <span className="text-gray-300 group-hover:text-cyan-400 transition-colors">
                            <strong>AND</strong> - Match only if <u>all</u> filters match
                          </span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name="logic"
                            value="OR"
                            checked={combinationLogic === 'OR'}
                            onChange={(e) => setCombinationLogic(e.target.value as 'AND' | 'OR')}
                            className="w-4 h-4 accent-purple-400"
                          />
                          <span className="text-gray-300 group-hover:text-purple-400 transition-colors">
                            <strong>OR</strong> - Match if <u>any</u> filter matches
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Available Filters Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Select filters to combine ({combinedFilterIds.length}/5)
                      </label>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {userFilters.map((filter) => (
                          <label
                            key={filter.id}
                            className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-cyan-500/50 transition-colors cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={combinedFilterIds.includes(filter.id)}
                              onChange={(e) => {
                                if (e.target.checked && combinedFilterIds.length < 5) {
                                  setCombinedFilterIds([...combinedFilterIds, filter.id]);
                                } else if (!e.target.checked) {
                                  setCombinedFilterIds(
                                    combinedFilterIds.filter((id) => id !== filter.id)
                                  );
                                }
                              }}
                              disabled={
                                !combinedFilterIds.includes(filter.id) &&
                                combinedFilterIds.length >= 5
                              }
                              className="w-4 h-4 accent-cyan-400 mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-100 font-medium truncate group-hover:text-cyan-400 transition-colors">
                                {filter.name}
                              </p>
                              <p className="text-xs text-gray-400 line-clamp-1">
                                {Object.keys(filter.conditions || {}).length} conditions
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Selection Summary */}
                    {combinedFilterIds.length > 0 && (
                      <div className="mt-4 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
                        <p className="text-sm text-cyan-300">
                          ✓ Combining <strong>{combinedFilterIds.length}</strong> filter{combinedFilterIds.length !== 1 ? 's' : ''} with{' '}
                          <strong>{combinationLogic}</strong> logic. This will create a new filter that matches when{' '}
                          {combinationLogic === 'AND'
                            ? 'all selected filters match'
                            : 'any of the selected filters match'}
                          .
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-6 text-gray-400">
                    <p>No existing filters available for combining</p>
                    <p className="text-xs mt-2">Create some filters first, then you can combine them here</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* ACTIONS */}
          <div className="flex gap-4 sticky bottom-6">
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
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
                  Create Filter
                </>
              )}
            </button>
          </div>
          
        </div>
      </div>
    </AuthWrapper>
    </>
  );
}
