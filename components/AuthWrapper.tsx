'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authHelpers, User } from '@/lib/supabase';
import { motion } from 'framer-motion';

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function AuthWrapper({ children, requireAdmin = false }: AuthWrapperProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifică autentificarea
    const currentUser = authHelpers.getCurrentUser();

    if (!currentUser) {
      router.push('/login');
      return;
    }

    // Verifică dacă e necesar admin
    if (requireAdmin && !currentUser.is_admin) {
      router.push('/dashboard');
      return;
    }

    // Setează cookie pentru middleware
    document.cookie = `rsq_session=${new Date().toISOString()}; path=/`;
    document.cookie = `rsq_is_admin=${currentUser.is_admin}; path=/`;

    setUser(currentUser as any);
    setLoading(false);
  }, [router, requireAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Checking authentication...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
