'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Lock, 
  User, 
  AlertCircle, 
  Zap, 
  CheckCircle2,
  Bell,
  MessageCircle,
  LogIn,
  ChevronRight,
  Mail
} from 'lucide-react';
import { authHelpers } from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();
  
  // ============================================
  // STATE
  // ============================================
  const [step, setStep] = useState(1); // 1: register, 2: notifications, 3: telegram, 4: login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Notifications
  const [enableNotifications, setEnableNotifications] = useState(false);
  
  // Telegram
  const [telegramUsername, setTelegramUsername] = useState('');
  const [enableTelegram, setEnableTelegram] = useState(false);

  // ============================================
  // HANDLERS
  // ============================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters!');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          fullName,
          email 
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSetupNeeded(false);
        setSuccess(true);
        setStep(2);
        setLoading(false);
      } else {
        const needsSetup = result.code === 'PROFILE_RELATION_MISSING' || result.code === 'DB_ERROR';
        setSetupNeeded(needsSetup);
        setError(result.error || 'Registration error');
        setLoading(false);
      }
    } catch (err) {
      setError('Connection error');
      setLoading(false);
    }
  };

  const handleSkipNotifications = () => {
    setStep(3);
  };

  const handleSkipTelegram = () => {
    setStep(4);
  };

  const handleFinish = () => {
    router.push('/login?user=' + username);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-amber/5 rounded-full blur-3xl animate-pulse-slow animation-delay-200" />
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-4"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-amber flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-display font-bold gradient-text mb-2">
            R$Q
          </h1>
          <p className="text-text-secondary">Football Scanner</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-between mb-8">
          {[1, 2, 3, 4].map((stepNum) => (
            <motion.div
              key={stepNum}
              className={`h-1 flex-1 mx-1 rounded-full transition-all ${
                stepNum <= step ? 'bg-accent-cyan' : 'bg-glass-medium'
              }`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: stepNum * 0.1 }}
            />
          ))}
        </div>

        {/* Step 1: Registration */}
        {step === 1 && (
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleRegister}
            className="glass-card p-8 space-y-6"
          >
            <div>
              <h2 className="text-2xl font-display font-bold text-text-primary mb-2">
                Create New Account
              </h2>
              <p className="text-text-muted text-sm">Step 1 of 4</p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-400 space-y-1">
                  <p className="font-mono text-xs break-all">{error}</p>
                  {setupNeeded && (
                    <a
                      href="/setup"
                      className="mt-1 inline-flex items-center gap-1 text-cyan-400 underline hover:text-cyan-300 font-medium text-sm"
                    >
                      Open diagnostics &amp; setup page &rarr;
                    </a>
                  )}
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field pl-12"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-12"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field pl-12"
                    placeholder="johndoe"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-12"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field pl-12"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : 'Register'}
              {!loading && <ChevronRight className="w-5 h-5" />}
            </button>

            <p className="text-center text-sm text-text-muted">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-accent-cyan hover:text-accent-cyan/80 font-semibold transition-colors"
              >
                Sign In
              </button>
            </p>
          </motion.form>
        )}

        {/* Step 2: Notifications */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-card p-8 space-y-6"
          >
            <div>
              <h2 className="text-2xl font-display font-bold text-text-primary mb-2">
                Notifications
              </h2>
              <p className="text-text-muted text-sm">Step 2 of 4</p>
            </div>

            <div className="bg-glass-light rounded-xl p-6 border border-glass-medium space-y-4">
              <div className="flex items-start gap-4">
                <Bell className="w-6 h-6 text-accent-amber mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary mb-1">
                    Enable Web Notifications
                  </h3>
                  <p className="text-sm text-text-muted">
                    Get real-time alerts when matching matches are found
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-3 mt-4">
                <input
                  type="checkbox"
                  checked={enableNotifications}
                  onChange={(e) => setEnableNotifications(e.target.checked)}
                  className="w-5 h-5 rounded accent-cyan cursor-pointer"
                />
                <span className="text-sm font-medium">Enable notifications</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkipNotifications}
                className="flex-1 btn-secondary py-3 rounded-lg font-semibold transition-all"
              >
                Skip
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 btn-primary py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Telegram */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-card p-8 space-y-6"
          >
            <div>
              <h2 className="text-2xl font-display font-bold text-text-primary mb-2">
                Connect Telegram
              </h2>
              <p className="text-text-muted text-sm">Step 3 of 4</p>
            </div>

            <div className="bg-glass-light rounded-xl p-6 border border-glass-medium space-y-4">
              <div className="flex items-start gap-4">
                <MessageCircle className="w-6 h-6 text-accent-cyan mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary mb-1">
                    Telegram Notifications
                  </h3>
                  <p className="text-sm text-text-muted">
                    Get alerts directly on Telegram for matches and filters
                  </p>
                </div>
              </div>

              {enableTelegram && (
                <div className="mt-4">
                  <label className="block text-sm font-display text-text-secondary mb-2">
                    Telegram Username
                  </label>
                  <div className="relative">
                    <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="text"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      className="input-field pl-12"
                      placeholder="@username"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 mt-4">
                <input
                  type="checkbox"
                  checked={enableTelegram}
                  onChange={(e) => setEnableTelegram(e.target.checked)}
                  className="w-5 h-5 rounded accent-cyan cursor-pointer"
                />
                <span className="text-sm font-medium">Enable Telegram</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkipTelegram}
                className="flex-1 btn-secondary py-3 rounded-lg font-semibold transition-all"
              >
                Skip
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 btn-primary py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-card p-8 space-y-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="mx-auto w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-accent-green" />
            </motion.div>

            <div>
              <h2 className="text-2xl font-display font-bold text-text-primary mb-2">
                Done!
              </h2>
              <p className="text-text-muted text-sm">Step 4 of 4</p>
            </div>

            <div className="bg-glass-light rounded-xl p-4 border border-glass-medium">
              <p className="text-sm text-text-secondary">
                Account {username} has been created successfully! ✨
              </p>
            </div>

            <button
              onClick={handleFinish}
              className="w-full btn-primary py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Login Now
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}