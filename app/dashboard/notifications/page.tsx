'use client';

// ============================================
// R$Q - NOTIFICATION SETTINGS
// ============================================
// Page for managing notifications
// For beginners: learn notification API, state management

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, 
  BellOff, 
  CheckCircle, 
  AlertCircle,
  Send,
  Settings as SettingsIcon,
  XCircle,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Radio,
  Zap,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { useBackgroundScanner } from '@/lib/background-scanner';
import {
  checkNotificationStatus,
  requestNotificationPermission,
  sendTestNotification,
  sendMatchNotification,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications';

import { authHelpers, dbHelpers } from '@/lib/supabase';
import {
  testTelegramConnection,
  verifyTelegramChatId,
  sendTelegramMessage,
  isTelegramConfigured,
} from '@/lib/telegram';

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function NotificationSettingsPage() {
  
  // ============================================
  // STATE
  // ============================================
  
  const backgroundScanner = useBackgroundScanner(true);
  const [scannerStats, setScannerStats] = useState({
    isRunning: false,
    totalScans: 0,
    notificationsSent: 0,
    activeFilters: 0,
    matchesScanned: 0,
    lastScanTime: null as Date | null,
  });
  
  const [notificationStatus, setNotificationStatus] = useState({
    supported: false,
    permission: 'default' as NotificationPermission,
    ready: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // ===== Telegram tab state =====
  const [activeTab, setActiveTab] = useState<'push' | 'telegram'>('push');

  // Read tab from URL params (e.g., ?tab=telegram from /dashboard/telegram redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'telegram') setActiveTab('telegram');
  }, []);

  const [tgLoading, setTgLoading] = useState(true);
  const [tgUser, setTgUser] = useState<any>(null);
  const [tgProfile, setTgProfile] = useState<any>(null);
  const [chatId, setChatId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [botInfo, setBotInfo] = useState<any>(null);
  const [configured, setConfigured] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);
  const [tgSuccess, setTgSuccess] = useState<string | null>(null);
  
  // ============================================
  // LOAD STATUS
  // ============================================
  
  useEffect(() => {
    loadNotificationStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'telegram') {
      loadTelegramSettings();
    }
  }, [activeTab]);
  
  // Update scanner stats every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = backgroundScanner.getState();
      setScannerStats({
        isRunning: stats.isRunning,
        totalScans: stats.totalScans,
        notificationsSent: stats.notificationsSent,
        activeFilters: stats.activeFilters,
        matchesScanned: stats.matchesScanned,
        lastScanTime: stats.lastScanTime,
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [backgroundScanner]);
  
  const loadNotificationStatus = async () => {
    const status = await checkNotificationStatus();
    setNotificationStatus(status);
    
    console.log('📊 Notification status:', status);
  };

  // ===== Telegram handlers =====
  const handleVerify = async () => {
    if (!chatId) {
      setTgError('Please enter your Chat ID');
      return;
    }
    setVerifying(true);
    setTgError(null);
    setTgSuccess(null);
    try {
      const result = await verifyTelegramChatId(chatId);
      if (!result.success) {
        setTgError(result.error || 'Verification failed');
        return;
      }
      setTgSuccess(`✅ Verified! Connected to ${result.user?.first_name || 'User'}`);
    } catch (err) {
      console.error('Error verifying:', err);
      setTgError('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleTestMessage = async () => {
    if (!chatId) {
      setTgError('Please enter and verify your Chat ID first');
      return;
    }
    setTesting(true);
    setTgError(null);
    setTgSuccess(null);
    try {
      const message = `\n🎯 <b>R$Q Test Notification</b>\n\n✅ Telegram integration is working!\n\nYou will receive notifications here when your filters match live matches.\n\n💡 Make sure to enable Telegram notifications in your filter settings.`.trim();
      const result = await sendTelegramMessage(chatId, message, 'HTML');
      if (!result.success) {
        setTgError(result.error || 'Failed to send test message');
        return;
      }
      setTgSuccess('✅ Test message sent! Check your Telegram!');
    } catch (err) {
      console.error('Error sending test:', err);
      setTgError('Failed to send test message');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!tgUser || !chatId) return;
    setSaving(true);
    setTgError(null);
    setTgSuccess(null);
    try {
      const { error: updateError } = await dbHelpers.updateUserProfile(tgUser.id, {
        telegram_chat_id: chatId,
        telegram_enabled: true,
        telegram_verified_at: new Date().toISOString(),
      });
      if (updateError) {
        setTgError(updateError);
        return;
      }
      setTgSuccess('✅ Telegram settings saved!');
      const updated = await dbHelpers.getUserProfile(tgUser.id);
      setTgProfile(updated);
    } catch (err) {
      console.error('Error saving:', err);
      setTgError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!tgUser) return;
    if (!confirm('Are you sure you want to disconnect Telegram?')) return;
    setSaving(true);
    try {
      const { error: updateError } = await dbHelpers.updateUserProfile(tgUser.id, {
        telegram_chat_id: null,
        telegram_enabled: false,
        telegram_verified_at: null,
      });
      if (updateError) {
        setTgError(updateError);
        return;
      }
      setChatId('');
      setTgSuccess('Telegram disconnected');
    } catch (err) {
      console.error('Error disconnecting:', err);
      setTgError('Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setTgSuccess('Copied to clipboard!');
    setTimeout(() => setTgSuccess(null), 2000);
  };

  // ===== Telegram load =====
  const loadTelegramSettings = async () => {
    setTgLoading(true);
    setTgError(null);
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) return;
      setTgUser(currentUser);

      const userProfile = await dbHelpers.getUserProfile(currentUser.id);
      setTgProfile(userProfile);
      if (userProfile?.telegram_chat_id) setChatId(userProfile.telegram_chat_id);

      const result = await testTelegramConnection();
      setConfigured(result.configured);
      setBotInfo(result.botInfo);
      if (!result.configured) setTgError(result.error || 'Telegram Bot not configured');
    } catch (err) {
      console.error('Error loading telegram settings:', err);
      setTgError('Failed to load Telegram settings');
    } finally {
      setTgLoading(false);
    }
  };
  
  // ============================================
  // HANDLERS
  // ============================================
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(false);

  const handleSubscribePush = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        setMessage({ type: 'error', text: 'User not found. Please login again.' });
        return;
      }
      const ok = await subscribeToPush(currentUser.id);
      if (ok) {
        setPushSubscribed(true);
        setMessage({ type: 'success', text: '✅ Subscribed to push (client) and saved on server.' });
      } else {
        setMessage({ type: 'error', text: '❌ Could not subscribe to push.' });
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      setMessage({ type: 'error', text: '❌ Error subscribing to push.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribePush = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        setMessage({ type: 'error', text: 'User not found. Please login again.' });
        return;
      }
      const ok = await unsubscribeFromPush(currentUser.id);
      if (ok) {
        setPushSubscribed(false);
        setMessage({ type: 'success', text: '✅ Unsubscribed from push.' });
      } else {
        setMessage({ type: 'error', text: '❌ Could not unsubscribe from push.' });
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setMessage({ type: 'error', text: '❌ Error unsubscribing from push.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendServerPushTest = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const currentUser = authHelpers.getCurrentUser();
      const payload = { title: 'R$Q Server Push Test', body: 'This is a server-sent push test.' };
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser?.id, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to send server push.' });
      } else {
        setMessage({ type: 'success', text: '✅ Server push request enqueued/sent.' });
      }
    } catch (err) {
      console.error('Error sending server push test:', err);
      setMessage({ type: 'error', text: '❌ Error sending server push.' });
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Request permission for notifications
   */
  const handleRequestPermission = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const granted = await requestNotificationPermission();
      
      if (granted) {
        setMessage({ 
          type: 'success', 
          text: '✅ Permission granted! You can now receive notifications.' 
        });
        
        // Reload status
        await loadNotificationStatus();
        
        // Trimite notificare de test automat
        setTimeout(() => {
          handleSendTest();
        }, 1000);
      } else {
        setMessage({ 
          type: 'error', 
          text: '❌ Permission denied. Check your browser settings.' 
        });
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error requesting permission.' 
      });
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Send test notification
   */
  const handleSendTest = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const success = await sendTestNotification();
      
      if (success) {
        setMessage({ 
          type: 'success', 
          text: '✅ Test notification sent! Check the corner of your screen.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: '❌ Could not send notification. Check permissions.' 
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error sending notification.' 
      });
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Send demo notification for match
   */
  const handleSendMatchDemo = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const success = await sendMatchNotification(
        {
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          league: 'Premier League',
          minute: 67,
          matchId: 99999,
        },
        ['Corners Over 8', 'Intense Attacks']
      );
      
      if (success) {
        setMessage({ 
          type: 'success', 
          text: '✅ Demo notification sent! Here\'s how match alerts will look.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: '❌ Could not send notification.' 
        });
      }
    } catch (error) {
      console.error('Error sending match notification:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error sending notification.' 
      });
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* ========== HEADER ========== */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-display font-bold gradient-text mb-2">
                  🔔 Notifications
                </h1>
                <p className="text-text-secondary">
                  Manage your notification settings (Web Push & Telegram)
                </p>
              </div>
              <div className="ml-4">
                <div className="inline-flex rounded-md shadow-sm" role="tablist">
                  <button
                    className={`px-4 py-2 rounded-l-md border transition-colors ${activeTab === 'push' ? 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan' : 'bg-transparent border-glass-medium hover:bg-glass-light'}`}
                    onClick={() => setActiveTab('push')}
                    role="tab"
                    aria-selected={activeTab === 'push'}
                  >
                    Web Push
                  </button>
                  <button
                    className={`px-4 py-2 rounded-r-md border transition-colors ${activeTab === 'telegram' ? 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan' : 'bg-transparent border-glass-medium hover:bg-glass-light'}`}
                    onClick={() => setActiveTab('telegram')}
                    role="tab"
                    aria-selected={activeTab === 'telegram'}
                  >
                    Telegram
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* ========== BACKGROUND SCANNER STATUS ========== */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left side - Info */}
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                {scannerStats.isRunning ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Radio className="w-6 h-6 text-accent-green animate-pulse" />
                  </div>
                ) : (
                  <Zap className="w-6 h-6 text-text-muted flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-lg">
                    Background Scanner
                    {scannerStats.isRunning && (
                      <span className="ml-2 text-sm text-accent-cyan animate-pulse">● Active</span>
                    )}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    {scannerStats.isRunning ? (
                      <>
                        ✅ Always running - auto-scanning every 30s in background
                        {scannerStats.lastScanTime && (
                          <> • Last: {new Date(scannerStats.lastScanTime).toLocaleTimeString()}</>
                        )}
                      </>
                    ) : (
                      <>
                        ⏸️ Initializing scanner...
                      </>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Right side - Stats */}
              <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="text-center p-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20">
                  <p className="text-text-muted mb-1">Total Scans</p>
                  <p className="font-semibold text-accent-cyan">{scannerStats.totalScans}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
                  <p className="text-text-muted mb-1">Active Filters</p>
                  <p className="font-semibold text-accent-purple">{scannerStats.activeFilters}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
                  <p className="text-text-muted mb-1">Alerts Sent</p>
                  <p className="font-semibold text-accent-blue">{scannerStats.notificationsSent}</p>
                </div>
              </div>
            </div>
          </motion.div>
          
          {activeTab === 'push' && (
            <div className="glass-card p-6">
            <h3 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-accent-cyan" />
              Notification Status
            </h3>
            
            <div className="space-y-4">
              {/* Browser Support */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-glass-light">
                <div className="flex items-center gap-3">
                  {notificationStatus.supported ? (
                    <CheckCircle className="w-5 h-5 text-accent-green" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-accent-red" />
                  )}
                  <div>
                    <p className="font-semibold">Browser Support</p>
                    <p className="text-sm text-text-muted">
                      {notificationStatus.supported 
                        ? 'Your browser supports notifications' 
                        : 'Your browser does NOT support notifications'}
                    </p>
                  </div>
                </div>
                <span className={`
                  px-3 py-1 rounded-full text-xs font-semibold
                  ${notificationStatus.supported 
                    ? 'bg-accent-green/10 text-accent-green' 
                    : 'bg-accent-red/10 text-accent-red'}
                `}>
                  {notificationStatus.supported ? 'Supported' : 'Not Supported'}
                </span>
              </div>
              
              {/* Permission Status */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-glass-light">
                <div className="flex items-center gap-3">
                  {notificationStatus.permission === 'granted' ? (
                    <CheckCircle className="w-5 h-5 text-accent-green" />
                  ) : notificationStatus.permission === 'denied' ? (
                    <AlertCircle className="w-5 h-5 text-accent-red" />
                  ) : (
                    <Bell className="w-5 h-5 text-accent-amber" />
                  )}
                  <div>
                    <p className="font-semibold">Permission</p>
                    <p className="text-sm text-text-muted">
                      {notificationStatus.permission === 'granted' && 'Permission granted'}
                      {notificationStatus.permission === 'denied' && 'Permission denied'}
                      {notificationStatus.permission === 'default' && 'Permission not requested'}
                    </p>
                  </div>
                </div>
                <span className={`
                  px-3 py-1 rounded-full text-xs font-semibold
                  ${notificationStatus.permission === 'granted' 
                    ? 'bg-accent-green/10 text-accent-green' 
                    : notificationStatus.permission === 'denied'
                    ? 'bg-accent-red/10 text-accent-red'
                    : 'bg-accent-amber/10 text-accent-amber'}
                `}>
                  {notificationStatus.permission}
                </span>
              </div>
              
              {/* Overall Status */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-glass-light">
                <div className="flex items-center gap-3">
                  {notificationStatus.ready ? (
                    <CheckCircle className="w-5 h-5 text-accent-green" />
                  ) : (
                    <BellOff className="w-5 h-5 text-text-muted" />
                  )}
                  <div>
                    <p className="font-semibold">Overall Status</p>
                    <p className="text-sm text-text-muted">
                      {notificationStatus.ready 
                        ? 'Notifications are ACTIVE and functional' 
                        : 'Notifications are NOT active'}
                    </p>
                  </div>
                </div>
                <span className={`
                  px-3 py-1 rounded-full text-xs font-semibold
                  ${notificationStatus.ready 
                    ? 'bg-accent-green/10 text-accent-green' 
                    : 'bg-text-muted/10 text-text-muted'}
                `}>
                  {notificationStatus.ready ? 'READY' : 'NOT READY'}
                </span>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'telegram' && (
            <>
              {/* ===== Telegram Tab ===== */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-display font-semibold">Telegram</h2>
                  {configured ? (
                    <div className="flex items-center gap-2 text-accent-green">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-semibold">Bot Configured</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-accent-red">
                      <XCircle className="w-5 h-5" />
                      <span className="text-sm font-semibold">Not Configured</span>
                    </div>
                  )}
                </div>

                {configured && botInfo && (
                  <div className="p-4 rounded-lg bg-glass-light">
                    <p className="text-sm text-text-muted mb-2">Connected Bot:</p>
                    <p className="font-semibold flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-accent-cyan" />
                      @{botInfo.username}
                    </p>
                  </div>
                )}

                {!configured && (
                  <div className="p-4 rounded-lg bg-accent-amber/10 border border-accent-amber/20 space-y-2">
                    <p className="text-sm text-accent-amber font-semibold">⚠️ Telegram Bot not configured</p>
                    <p className="text-xs text-text-muted">
                      Set <code className="bg-glass-light px-1 rounded">TELEGRAM_BOT_TOKEN</code> in your Vercel environment variables (or <code className="bg-glass-light px-1 rounded">.env.local</code> for local dev), then redeploy.
                    </p>
                    <a
                      href="https://core.telegram.org/bots#how-do-i-create-a-bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-cyan underline"
                    >
                      How to create a Telegram bot →
                    </a>
                  </div>
                )}
              </div>

              {/* Setup / Form */}
              {configured && !tgProfile?.telegram_chat_id && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
                  <h2 className="text-xl font-display font-semibold mb-4">Setup Guide</h2>
                  <div className="space-y-4 text-sm">
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan flex items-center justify-center font-bold">1</span>
                      <div>
                        <p className="font-semibold mb-1">Start the Bot</p>
                        <p className="text-text-muted mb-2">Open Telegram and start a chat with the bot:</p>
                        {botInfo && (
                          <button onClick={() => window.open(`https://t.me/${botInfo.username}`, '_blank')} className="btn-secondary text-sm flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Open @{botInfo.username}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan flex items-center justify-center font-bold">2</span>
                      <div>
                        <p className="font-semibold mb-1">Get Your Chat ID</p>
                        <p className="text-text-muted mb-2"><code className="px-2 py-0.5 rounded bg-glass-dark">/start</code> to the bot</p>
                        <p className="text-text-muted">The bot will reply with your Chat ID</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-cyan/20 text-accent-cyan flex items-center justify-center font-bold">3</span>
                      <div>
                        <p className="font-semibold mb-1">Enter Chat ID Below</p>
                        <p className="text-text-muted">Copy your Chat ID and paste it in the form below</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {configured && (
                <div className="glass-card p-6">
                  <h2 className="text-xl font-display font-semibold mb-4">{tgProfile?.telegram_chat_id ? 'Telegram Connection' : 'Connect Telegram'}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Telegram Chat ID</label>
                      <div className="flex gap-2">
                        <input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Enter your Chat ID (e.g., 123456789)" className="input-field flex-1" disabled={!!tgProfile?.telegram_chat_id} />
                        {tgProfile?.telegram_chat_id && (
                          <button onClick={() => copyToClipboard(chatId)} className="btn-secondary px-4" title="Copy Chat ID"><Copy className="w-4 h-4" /></button>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-1">Get your Chat ID by messaging the bot</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {!tgProfile?.telegram_chat_id ? (
                        <>
                          <button onClick={handleVerify} disabled={!chatId || verifying} className="btn-secondary flex items-center gap-2">{verifying ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>) : (<><CheckCircle className="w-4 h-4" /> Verify</>)}</button>
                          <button onClick={handleSave} disabled={!chatId || saving} className="btn-primary flex items-center gap-2">{saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>) : (<><CheckCircle className="w-4 h-4" /> Save</>)}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={handleTestMessage} disabled={testing} className="btn-primary flex items-center gap-2">{testing ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>) : (<><Send className="w-4 h-4" /> Send Test</>)}</button>
                          <button onClick={handleDisconnect} className="btn-secondary text-accent-red flex items-center gap-2"><XCircle className="w-4 h-4" /> Disconnect</button>
                        </>
                      )}
                    </div>

                    {tgError && (<div className="mt-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20"><p className="text-sm text-accent-red flex items-center gap-2"><AlertCircle className="w-4 h-4" />{tgError}</p></div>)}
                    {tgSuccess && (<div className="mt-4 p-3 rounded-lg bg-accent-green/10 border border-accent-green/20"><p className="text-sm text-accent-green flex items-center gap-2"><CheckCircle className="w-4 h-4" />{tgSuccess}</p></div>)}
                  </div>
                </div>
              )}

              <div className="glass-card p-6">
                <h3 className="font-semibold text-accent-cyan mb-3">💡 How Telegram works</h3>
                <ul className="space-y-2 text-sm text-text-muted">
                  <li>• Connect your Telegram account once</li>
                  <li>• Enable Telegram notifications on your filters</li>
                  <li>• Receive instant alerts when matches meet your criteria</li>
                  <li>• Works on all devices - phone, tablet, desktop</li>
                  <li>• No need to keep browser open!</li>
                </ul>
              </div>
            </>
          )}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`
                p-4 rounded-xl border
                ${message.type === 'success' 
                  ? 'bg-accent-green/10 border-accent-green/20 text-accent-green' 
                  : 'bg-accent-red/10 border-accent-red/20 text-accent-red'}
              `}
            >
              <p className="text-sm">{message.text}</p>
            </motion.div>
          )}
          
          {/* ========== ACTIONS ========== */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xl font-display font-semibold mb-4">
              ⚡ Actions
            </h3>
            
            {/* Request Permission */}
            {notificationStatus.permission !== 'granted' && (
              <div className="p-4 rounded-xl bg-accent-cyan/5 border border-accent-cyan/20">
                <div className="flex items-start gap-3 mb-3">
                  <Bell className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Enable Notifications</p>
                    <p className="text-sm text-text-muted">
                      To receive alerts when matches match your filters, 
                      you need to grant notification permission.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRequestPermission}
                  disabled={loading || !notificationStatus.supported}
                  className="btn-primary w-full"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    <>
                      <Bell className="w-5 h-5 inline mr-2" />
                      Enable Notifications
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* Test Buttons */}
            {notificationStatus.ready && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Simple Test */}
                  <button
                    onClick={handleSendTest}
                    disabled={loading}
                    className="btn-secondary p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Send className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">Simple Test</p>
                        <p className="text-xs text-text-muted">
                          Send a test notification
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Match Demo */}
                  <button
                    onClick={handleSendMatchDemo}
                    disabled={loading}
                    className="btn-secondary p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Bell className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">Match Demo</p>
                        <p className="text-xs text-text-muted">
                          Simulate match alert
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
                <div className="mt-4 flex gap-3">
                  {!pushSubscribed ? (
                    <button onClick={handleSubscribePush} className="btn-primary">Subscribe (client)</button>
                  ) : (
                    <button onClick={handleUnsubscribePush} className="btn-secondary">Unsubscribe</button>
                  )}

                  <button onClick={handleSendServerPushTest} className="btn-secondary">Send Server Push Test</button>
                </div>
              </>
            )}
          </div>
          
          {/* ========== INFO ========== */}
          <div className="glass-card p-4 text-sm">
            <h4 className="font-semibold text-accent-cyan mb-2">
              💡 How do notifications work?
            </h4>
            <ul className="space-y-1 text-text-muted">
              <li>• The app scans live matches every 45 seconds</li>
              <li>• When a match matches your active filters → you receive a notification</li>
              <li>• Notifications appear in the corner of your screen (Windows: bottom-right, Mac: top-right)</li>
              <li>• You can enable/disable notifications per filter in the Filters section</li>
              <li>• Notifications work ONLY if the app is open in your browser</li>
              <li>• For permanent notifications (even when the app is closed) → upgrade to full PWA</li>
            </ul>
          </div>
          
          {/* Browser permissions help */}
          {notificationStatus.permission === 'denied' && (
            <div className="glass-card p-4 border-l-4 border-accent-amber">
              <h4 className="font-semibold text-accent-amber mb-2">
                ⚠️ Permission Denied - How to reset it?
              </h4>
              <div className="text-sm text-text-muted space-y-2">
                <p><strong>Chrome/Edge:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Click the 🔒 (lock) icon to the left of the URL</li>
                  <li>Find &quot;Notifications&quot; → select &quot;Allow&quot;</li>
                  <li>Refresh the page (F5)</li>
                </ol>
                
                <p className="mt-3"><strong>Firefox:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Click the (i) icon to the left of the URL</li>
                  <li>Permissions → Notifications → Allow</li>
                  <li>Refresh the page (F5)</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthWrapper>
  );
}
