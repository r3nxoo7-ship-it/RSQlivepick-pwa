'use client';
import { motion } from 'framer-motion';

interface StatProps {
  label: string;
  homeValue: number;
  awayValue: number;
}

export const DynamicStatBar = ({ label, homeValue, awayValue }: StatProps) => {
  const total = homeValue + awayValue;
  // Calculăm procentul. Dacă ambele sunt 0, punem 50/50.
  const homePercent = total === 0 ? 50 : (homeValue / total) * 100;
  const awayPercent = 100 - homePercent;

  return (
    <div className="w-full mb-5 px-2">
      <div className="flex justify-between items-end mb-1">
        <div className="text-left">
          <span className="text-2xl font-black text-accent-cyan leading-none">{homeValue}</span>
        </div>
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tighter pb-1">
          {label}
        </span>
        <div className="text-right">
          <span className="text-2xl font-black text-accent-blue leading-none">{awayValue}</span>
        </div>
      </div>

      <div className="relative h-2.5 w-full bg-white/5 rounded-full overflow-hidden flex border border-white/5">
        <motion.div
          initial={{ width: "50%" }}
          animate={{ width: `${homePercent}%` }}
          transition={{ type: "spring", stiffness: 40, damping: 12 }}
          className="h-full bg-accent-cyan shadow-[0_0_12px_rgba(0,255,242,0.6)]"
        />
        <motion.div
          initial={{ width: "50%" }}
          animate={{ width: `${awayPercent}%` }}
          transition={{ type: "spring", stiffness: 40, damping: 12 }}
          className="h-full bg-accent-blue shadow-[0_0_12px_rgba(59,130,246,0.6)]"
        />
      </div>
    </div>
  );
};