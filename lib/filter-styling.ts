/**
 * Template Styling System
 * Auto-assigns colors and themes to filters based on templates
 */

export type FilterColor = 'cyan' | 'green' | 'amber' | 'purple' | 'blue' | 'red' | 'gray';

export const colorConfig: Record<FilterColor, { bg: string; border: string; text: string; icon: string }> = {
  cyan: {
    bg: 'from-accent-cyan/10 to-cyan-900/5',
    border: 'border-accent-cyan/30',
    text: 'text-accent-cyan',
    icon: 'bg-accent-cyan',
  },
  green: {
    bg: 'from-accent-green/10 to-green-900/5',
    border: 'border-accent-green/30',
    text: 'text-accent-green',
    icon: 'bg-accent-green',
  },
  amber: {
    bg: 'from-accent-amber/10 to-amber-900/5',
    border: 'border-accent-amber/30',
    text: 'text-accent-amber',
    icon: 'bg-accent-amber',
  },
  purple: {
    bg: 'from-accent-purple/10 to-purple-900/5',
    border: 'border-accent-purple/30',
    text: 'text-accent-purple',
    icon: 'bg-accent-purple',
  },
  blue: {
    bg: 'from-accent-blue/10 to-blue-900/5',
    border: 'border-accent-blue/30',
    text: 'text-accent-blue',
    icon: 'bg-accent-blue',
  },
  red: {
    bg: 'from-accent-red/10 to-red-900/5',
    border: 'border-accent-red/30',
    text: 'text-accent-red',
    icon: 'bg-accent-red',
  },
  gray: {
    bg: 'from-glass-medium/30 to-glass-light/20',
    border: 'border-glass-lighter',
    text: 'text-text-secondary',
    icon: 'bg-glass-medium',
  },
};

/**
 * Get color config for a specific color
 */
export function getColorConfig(color?: FilterColor) {
  return colorConfig[color || 'cyan'];
}

/**
 * Get gradient background class based on color
 */
export function getColorGradient(color?: FilterColor): string {
  const config = getColorConfig(color);
  return `bg-gradient-to-br ${config.bg}`;
}

/**
 * Get border color class
 */
export function getColorBorder(color?: FilterColor): string {
  const config = getColorConfig(color);
  return `border ${config.border}`;
}

/**
 * Get text color class
 */
export function getColorText(color?: FilterColor): string {
  const config = getColorConfig(color);
  return config.text;
}

/**
 * Generate a list of filter colors with preview
 */
export function getColorOptions(): Array<{ color: FilterColor; label: string; preview: string }> {
  return [
    { color: 'cyan', label: 'Cyan', preview: 'Predictive analytics' },
    { color: 'green', label: 'Green', preview: 'Safe/conservative' },
    { color: 'amber', label: 'Amber', preview: 'Popular/trending' },
    { color: 'purple', label: 'Purple', preview: 'Advanced/experimental' },
    { color: 'blue', label: 'Blue', preview: 'Stats-based' },
    { color: 'red', label: 'Red', preview: 'Aggressive/high-risk' },
  ];
}

/**
 * Assign default colors to filter categories
 */
export function getCategoryColor(category?: string): FilterColor {
  switch (category) {
    case 'corners':
      return 'cyan';
    case 'goals':
      return 'green';
    case 'cards':
      return 'red';
    case 'shots':
      return 'blue';
    case 'advanced':
      return 'purple';
    case 'popular':
      return 'amber';
    default:
      return 'gray';
  }
}
