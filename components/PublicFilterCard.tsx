'use client';

import { motion } from 'framer-motion';
import { Download, Share2 } from 'lucide-react';
import { Filter } from '@/lib/supabase';
import { getColorConfig, FilterColor } from '@/lib/filter-styling';

interface PublicFilterCardProps {
  filter: Filter & { color?: FilterColor };
  onImport?: () => void;
  isLoading?: boolean;
  alreadyImported?: boolean;
}

export default function PublicFilterCard({
  filter,
  onImport,
  isLoading,
  alreadyImported,
}: PublicFilterCardProps) {
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
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-display font-bold text-lg ${config.text} group-hover:text-opacity-100 transition`}>
                {filter.name}
              </h3>
              <Share2 className="w-4 h-4 text-accent-cyan opacity-70" />
            </div>
            <p className="text-xs text-text-muted mt-1 line-clamp-2">
              {filter.description || 'No description'}
            </p>
          </div>
        </div>

        {/* Creator & Stats */}
        <div className="space-y-2 mb-4 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-glass-light">
            <div className="text-text-muted">Creator</div>
            <div className={`font-semibold ${config.text}`}>{filter.forked_from_user || 'Community'}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-glass-light">
              <div className="text-text-muted">Triggered</div>
              <div className={`font-bold ${config.text}`}>{filter.trigger_count || 0}</div>
            </div>
            <div className="p-2 rounded bg-glass-light">
              <div className="text-text-muted">Success</div>
              <div className={`font-bold ${config.text}`}>{filter.success_rate || '-'}%</div>
            </div>
          </div>
        </div>

        {/* Import Button */}
        <button
          onClick={onImport}
          disabled={isLoading || alreadyImported}
          className={`w-full py-3 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition ${
            alreadyImported
              ? 'bg-text-muted/20 text-text-muted cursor-not-allowed'
              : `bg-gradient-to-r ${config.bg} text-white hover:opacity-90 disabled:opacity-50`
          }`}
        >
          <Download className="w-4 h-4" />
          {alreadyImported ? 'Already Imported' : 'Import Filter'}
        </button>

        {/* Info */}
        {filter.version && (
          <div className="mt-3 text-xs text-text-muted text-center">
            v{filter.version}.0 • {filter.trigger_count ? 'Tested' : 'New'}
          </div>
        )}
      </div>
    </motion.div>
  );
}
