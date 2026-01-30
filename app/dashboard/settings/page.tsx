'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Settings,
  ArrowLeft,
  User,
  Lock,
  Bell,
  Save,
  AlertCircle,
  CheckCircle,
  LogOut,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Get user from localStorage (set during login)
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('rsq_user');
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          setUser(userData);
          setFormData({
            full_name: userData.full_name || '',
            email: userData.email || '',
          });
        } catch (err) {
          console.error('Failed to parse user data:', err);
        }
      }
    }
    setLoading(false);
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!user?.id) {
        setError('User ID not found');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateProfile',
          userId: user.id,
          full_name: formData.full_name,
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        return;
      }

      // Update localStorage with new data from API response
      if (typeof window !== 'undefined' && data.data) {
        const apiData = data.data;
        const updatedUser = {
          id: apiData.id || user.id,
          username: apiData.username || user.username,
          full_name: apiData.full_name || formData.full_name || user.full_name,
          email: apiData.email || formData.email || user.email,
          is_admin: apiData.is_admin || user.is_admin,
        };
        localStorage.setItem('rsq_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        console.log('✅ Profile saved to localStorage:', updatedUser);
      } else {
        // Fallback if API doesn't return data
        console.warn('⚠️ API did not return data, using form data');
        const updatedUser = {
          id: user.id,
          username: user.username,
          full_name: formData.full_name || user.full_name,
          email: formData.email || user.email,
          is_admin: user.is_admin,
        };
        localStorage.setItem('rsq_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Profile update error:', err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      setSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setSaving(false);
      return;
    }

    try {
      if (!user?.id) {
        setError('User ID not found');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'changePassword',
          userId: user.id,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to change password');
        return;
      }

      setSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Password change error:', err);
      setError('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    authHelpers.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <AuthWrapper>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-cyan"></div>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-to-br from-dark-primary via-dark-secondary to-dark-accent p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-text-secondary" />
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text">Settings</h1>
              <p className="text-text-secondary mt-1">Manage your account and preferences</p>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-500">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-green-500">{success}</p>
            </motion.div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-white/10">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'password', label: 'Password', icon: Lock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-3 font-display font-semibold flex items-center gap-2 transition-all ${
                  activeTab === id
                    ? 'text-accent-cyan border-b-2 border-accent-cyan'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'profile' && (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSaveProfile}
              className="glass-card p-6 space-y-6"
            >
              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className="input-field w-full"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="input-field w-full"
                  placeholder="your@email.com"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </motion.form>
          )}

          {activeTab === 'password' && (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleChangePassword}
              className="glass-card p-6 space-y-6"
            >
              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  className="input-field w-full"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  className="input-field w-full"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-display text-text-secondary mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="input-field w-full"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </motion.form>
          )}

          {/* Logout Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-8 pt-8 border-t border-glass-medium"
          >
            <div className="mb-6">
              <h2 className="text-xl font-display font-bold text-text-primary mb-2">Account</h2>
              <p className="text-text-secondary">Sign out of your account</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-accent-red/50 hover:border-accent-red text-accent-red hover:bg-accent-red/10 transition-all font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </motion.div>
        </motion.div>
      </div>
    </AuthWrapper>
  );
}
