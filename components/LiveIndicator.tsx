// ============================================
// R$Q - LIVE INDICATOR COMPONENT
// ============================================
// An animated indicator that shows a match is LIVE
// For beginners: demonstrates animations and CSS classes

import { motion } from 'framer-motion'; // Library for smooth animations

// ============================================
// COMPONENT
// ============================================

/**
 * LiveIndicator - Displays a pulsing red dot + "LIVE" text
 *
 * Props:
 * @param minute - Current match minute (optional)
 * @param className - Extra CSS classes (optional)
 *
 * Usage:
 * <LiveIndicator minute={67} />
 * <LiveIndicator /> // without minute
 */
interface LiveIndicatorProps {
  minute?: number | null;     // Current minute (e.g., 67)
  className?: string;          // Extra CSS classes
}

export default function LiveIndicator({ minute, className = '' }: LiveIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Animated red dot */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse (larger pulsing circle) */}
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-accent-red"
          animate={{
            scale: [1, 1.5, 1],           // Scale up and down
            opacity: [0.7, 0, 0.7],       // Fade in/out
          }}
          transition={{
            duration: 2,                   // 2 seconds per cycle
            repeat: Infinity,              // Repeat indefinitely
            ease: "easeInOut",             // Smooth easing
          }}
        />
        
        {/* Inner dot (static small circle) */}
        <div className="relative w-2 h-2 rounded-full bg-accent-red" />
      </div>
      
      {/* Text "LIVE" */}
      <span className="text-accent-red font-display font-bold text-sm tracking-wider">
        LIVE
      </span>
      
      {/* Minute (if provided) */}
      {minute !== null && minute !== undefined && (
        <span className="text-text-muted text-sm">
          {minute}&apos;
        </span>
      )}
    </div>
  );
}

// ============================================
// EXPORT COMPONENT
// ============================================

// USAGE EXAMPLES:
/*
import LiveIndicator from '@/components/LiveIndicator';

// With minute
<LiveIndicator minute={67} />

// Without minute
<LiveIndicator />

// With custom className
<LiveIndicator minute={45} className="ml-4" />
*/
