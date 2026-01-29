'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-cyan-500/5 blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter">
          R$Q <span className="text-cyan-500">LIVE</span>
        </h1>
        
        <p className="text-gray-300 text-lg max-w-lg mx-auto">
          Private live match scanner: create powerful, multi-condition filters and get real-time notifications (Telegram & web). Ideal for live-monitoring and advanced match scouting.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link href="/register" className="py-3 px-6 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            Register <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            Login <ArrowRight size={18} />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-[#0f1724] p-6 rounded-2xl border border-white/5">
            <h3 className="text-white font-semibold text-lg">What it does</h3>
            <p className="text-gray-400 mt-2 text-sm">Continuously scans live football matches, applies user-defined filters (corners, shots, cards, time ranges) and notifies you when conditions match.</p>
            <p className="text-sm text-amber-300 mt-3">Use cases: live alerts, scouting, value betting signals.</p>
          </div>

          <div className="bg-[#0f1724] p-6 rounded-2xl border border-white/5">
            <h3 className="text-white font-semibold text-lg">Why try it</h3>
            <p className="text-gray-400 mt-2 text-sm">Fast, private, and configurable. Build 100+ templates or craft your own multi-condition filters. Notifications via Telegram and web push.</p>
            <ul className="text-sm text-gray-400 mt-3 space-y-1">
              <li>• Low-latency live scanning</li>
              <li>• Per-user filters with RLS</li>
              <li>• Safe notifications (validation prevents noise)</li>
            </ul>
          </div>

          <div className="bg-[#0f1724] p-6 rounded-2xl border border-white/5">
            <h3 className="text-white font-semibold text-lg">Live stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/3 rounded">
                <div className="text-xs text-gray-300">Matches scanned</div>
                <div className="text-2xl font-bold text-white">1,248</div>
              </div>
              <div className="p-3 bg-white/3 rounded">
                <div className="text-xs text-gray-300">Filters active</div>
                <div className="text-2xl font-bold text-white">342</div>
              </div>
              <div className="p-3 bg-white/3 rounded">
                <div className="text-xs text-gray-300">Triggers today</div>
                <div className="text-2xl font-bold text-white">27</div>
              </div>
              <div className="p-3 bg-white/3 rounded">
                <div className="text-xs text-gray-300">Templates</div>
                <div className="text-2xl font-bold text-white">104</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">(Numbers are illustrative — live values appear after login)</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-8">© All rights reserved — LivePick Scanner</p>
      </motion.div>
    </div>
  );
}
