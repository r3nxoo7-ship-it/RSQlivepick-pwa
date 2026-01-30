'use client';

import { motion } from 'framer-motion';
import { Trash2, Edit, Bell, BellOff } from 'lucide-react';
import { Filter } from '@/lib/supabase';
import { getColorConfig, FilterColor } from '@/lib/filter-styling';

interface FilterCardProps {
  filter: Filter & { color?: FilterColor };
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleNotification?: () => void;
  isLoading?: boolean;
}

export default function FilterCard({
  filter,
  onEdit,
  onDelete,
  onToggleNotification,
  isLoading,
}: FilterCardProps) {
  const color = filter.color || 'cyan';
  const config = getColorConfig(color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group relative"
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${config.bg} opacity-0 group-hover:opacity-100 transition duration-300`} />

      {/* Card */}
      <div className={`relative glass-card p-4 rounded-xl border-l-4 ${config.border} group-hover:${config.border} transition h-full flex flex-col`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className={`font-display font-bold text-lg ${config.text} group-hover:text-opacity-100 transition`}>
              {filter.name}
            </h3>
            <p className="text-xs text-text-muted mt-1 line-clamp-1">
              {filter.description || 'No description'}
            </p>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0 ml-2">
            {filter.is_active ? (
              <span className="px-2 py-1 rounded-full bg-accent-green/20 text-accent-green text-xs font-semibold">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full bg-text-muted/20 text-text-muted text-xs font-semibold">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="p-2 rounded bg-glass-light">
            <div className="text-text-muted">Triggered</div>
            <div className={`font-bold ${config.text}`}>{filter.trigger_count || 0}</div>
          </div>
          <div className="p-2 rounded bg-glass-light">
            <div className="text-text-muted">Success</div>
            <div className={`font-bold ${config.text}`}>{filter.success_rate || '-'}%</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          {onToggleNotification && (
            <button
              onClick={onToggleNotification}
              disabled={isLoading}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition ${
                filter.notification_enabled
                  ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                  : 'bg-glass-light text-text-secondary hover:bg-glass-lighter'
              }`}
            >
              {filter.notification_enabled ? (
                <>
                  <Bell className="w-3 h-3" />
                  <span className="hidden sm:inline">Enabled</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3 h-3" />
                  <span className="hidden sm:inline">Disabled</span>
                </>
              )}
            </button>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              disabled={isLoading}
              className="py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center bg-glass-light text-text-secondary hover:bg-glass-lighter transition"
            >
              <Edit className="w-3 h-3" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isLoading}
              className="py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center bg-accent-red/20 text-accent-red hover:bg-accent-red/30 transition"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
