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
  Settings as SettingsIcon
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import {
  checkNotificationStatus,
  requestNotificationPermission,
  sendTestNotification,
  sendMatchNotification,
} from '@/lib/notifications';

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function NotificationSettingsPage() {
  
  // ============================================
  // STATE
  // ============================================
  
  const [notificationStatus, setNotificationStatus] = useState({
    supported: false,
    permission: 'default' as NotificationPermission,
    ready: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // ============================================
  // LOAD STATUS
  // ============================================
  
  useEffect(() => {
    loadNotificationStatus();
  }, []);
  
  const loadNotificationStatus = async () => {
    const status = await checkNotificationStatus();
    setNotificationStatus(status);
    
    console.log('📊 Notification status:', status);
  };
  
  // ============================================
  // HANDLERS
  // ============================================
  
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
            <h1 className="text-3xl font-display font-bold gradient-text mb-2">
              🔔 Notifications
            </h1>
            <p className="text-text-secondary">
              Manage your push notification settings
            </p>
          </div>
          
          {/* ========== STATUS CARD ========== */}
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
          
          {/* ========== MESSAGE ========== */}
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
