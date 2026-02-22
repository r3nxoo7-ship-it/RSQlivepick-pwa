'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  Shield,
  User as UserIcon,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { authHelpers, dbHelpers, User } from '@/lib/supabase';
import AuthWrapper from '@/components/AuthWrapper';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    is_admin: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const allUsers = await dbHelpers.getAllUsers();
    setUsers(allUsers);
    setLoading(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { error: createError } = await dbHelpers.createUser(formData);

    if (createError) {
      setError(createError);
      return;
    }

    setSuccess(`Utilizator ${formData.username} creat cu succes!`);
    setFormData({
      username: '',
      password: '',
      full_name: '',
      email: '',
      is_admin: false,
    });
    setShowAddUser(false);
    loadUsers();
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Sigur vrei să ștergi utilizatorul "${username}"?`)) {
      return;
    }

    const { error: deleteError } = await dbHelpers.deleteUser(userId);

    if (deleteError) {
      setError(deleteError);
      return;
    }

    setSuccess(`Utilizator ${username} șters cu succes!`);
    loadUsers();
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const { error: toggleError } = await dbHelpers.toggleUserStatus(userId, !currentStatus);

    if (toggleError) {
      setError(toggleError);
      return;
    }

    setSuccess('Status utilizator actualizat!');
    loadUsers();
  };

  return (
    <AuthWrapper requireAdmin>
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 rounded-xl hover:bg-glass-light transition-all"
                title="Go back to dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                  <Shield className="w-8 h-8 text-accent-amber" />
                  Admin Panel
                </h1>
                <p className="text-text-secondary mt-1">
                  Gestionează utilizatorii aplicației
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Adaugă User
            </button>
          </div>

          {/* Messages */}
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

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-4 rounded-xl bg-accent-green/10 border border-accent-green/20"
            >
              <Check className="w-5 h-5 text-accent-green flex-shrink-0" />
              <p className="text-sm text-accent-green">{success}</p>
            </motion.div>
          )}

          {/* Add User Form */}
          {showAddUser && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-display font-semibold mb-4">
                Adaugă Utilizator Nou
              </h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-display text-text-secondary mb-2">
                      Username *
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-display text-text-secondary mb-2">
                      Parolă *
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-display text-text-secondary mb-2">
                      Nume Complet
                    </label>
                    <input
                      id="full_name"
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-display text-text-secondary mb-2">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_admin"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                    className="w-5 h-5 rounded border-glass-medium bg-glass-light accent-accent-cyan"
                  />
                  <label htmlFor="is_admin" className="text-sm text-text-secondary flex items-center gap-2">
                    <Shield className="w-4 h-4 text-accent-amber" />
                    Acces Admin
                  </label>
                </div>

                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">
                    Creează Utilizator
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="btn-secondary"
                  >
                    Anulează
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Users List */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-glass-medium">
              <h3 className="text-xl font-display font-semibold">
                Utilizatori ({users.length})
              </h3>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-text-secondary">Se încarcă...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <UserIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">Nu există utilizatori</p>
              </div>
            ) : (
              <div className="divide-y divide-glass-medium">
                {users.map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-6 hover:bg-glass-light transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${
                          user.is_admin
                            ? 'bg-gradient-to-br from-accent-amber to-accent-cyan'
                            : 'bg-glass-medium'
                        } flex items-center justify-center`}>
                          {user.is_admin ? (
                            <Shield className="w-6 h-6 text-primary" />
                          ) : (
                            <UserIcon className="w-6 h-6 text-text-secondary" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-semibold">
                              {user.full_name || user.username}
                            </h4>
                            {user.is_admin && (
                              <span className="px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber text-xs font-display">
                                Admin
                              </span>
                            )}
                            {!user.is_active && (
                              <span className="px-2 py-0.5 rounded-full bg-text-muted/10 text-text-muted text-xs font-display">
                                Inactiv
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-text-secondary">
                            @{user.username}
                            {user.email && ` • ${user.email}`}
                          </p>
                          <p className="text-xs text-text-muted mt-1">
                            Creat: {new Date(user.created_at).toLocaleDateString('ro-RO')}
                            {user.last_login && (
                              <> • Ultimul login: {new Date(user.last_login).toLocaleDateString('ro-RO')}</>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(user.id, user.is_active)}
                          className={`p-2 rounded-xl transition-all ${
                            user.is_active
                              ? 'hover:bg-text-muted/10 text-text-secondary'
                              : 'hover:bg-accent-green/10 text-accent-green'
                          }`}
                          title={user.is_active ? 'Dezactivează' : 'Activează'}
                        >
                          {user.is_active ? (
                            <X className="w-5 h-5" />
                          ) : (
                            <Check className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="p-2 rounded-xl hover:bg-accent-red/10 text-text-secondary hover:text-accent-red transition-all"
                          title="Șterge"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
