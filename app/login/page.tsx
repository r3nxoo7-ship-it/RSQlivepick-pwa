'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, User, AlertCircle, Zap } from 'lucide-react';
import { authHelpers } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user, error } = await authHelpers.login(username, password);

      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      if (user) {
        // 1. Salvează în localStorage pentru client
        authHelpers.saveUser(user);
        
        // 2. SETEAZĂ COOKIE-UL PENTRU MIDDLEWARE (IMPORTANT!)
        // Acest pas face ca serverul să te lase să intri în /dashboard
        document.cookie = "rsq_session=active; path=/; max-age=86400; SameSite=Lax";
        
        // 3. Dacă ești admin, setează și cookie-ul de admin (opțional)
        if (username === 'admin') { // Exemplu de verificare
           document.cookie = "rsq_is_admin=true; path=/; max-age=86400; SameSite=Lax";
        }

        // Redirect la dashboard
        router.push('/dashboard');
        router.refresh(); // Forțează reîncărcarea pentru middleware
      }
    } catch (err) {
      setError('Authentication error. Please try again.');
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-amber/5 rounded-full blur-3xl animate-pulse-slow animation-delay-200" />
      </div>

      {/* Login Card */}
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

        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          onSubmit={handleLogin}
          className="glass-card p-8 space-y-6"
        >
          <div className="space-y-4">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-display text-text-secondary mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-12"
                  placeholder="Introdu username-ul"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-display text-text-secondary mb-2">
                Parolă
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-12"
                  placeholder="Introdu parola"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-4 rounded-xl bg-accent-red/10 border border-accent-red/20"
            >
              <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0" />
              <p className="text-sm text-accent-red">{error}</p>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary relative overflow-hidden group"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Authenticating...
              </span>
            ) : (
              <span>Sign In</span>
            )}
          </button>

          {/* Register Link */}
          <p className="text-center text-sm text-text-muted">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="text-accent-cyan hover:text-accent-cyan/80 font-semibold transition-colors"
            >
              Create now
            </button>
          </p>

          {/* Info */}
          <div className="text-center">
            <p className="text-xs text-text-muted">
              Aplicație privată • Acces restricționat
            </p>
          </div>
        </motion.form>

        {/* Copyright & Ownership Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-6 p-4 glass-card text-center"
        >
          <p className="text-xs text-text-muted mb-2">© Derechos Reservados</p>
          <div className="space-y-1 text-xs text-text-secondary">
            <p>Propiedad Intelectual Protegida</p>
            <p>Todos los derechos reservados 2026</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
