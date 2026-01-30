"use client";

// ============================================
// NOTIFICATION HELPERS
// ============================================
// Functions for browser push notifications (Notification API + Service Worker)

// ============================================
// TYPES
// ============================================

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}

// ============================================
// PERMISSION MANAGEMENT
// ============================================

/**
 * Check whether the current browser environment supports Notifications + Service Worker
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get the status of notification permission
 * 
 * @returns 'granted' | 'denied' | 'default'
 * 
 * EXPLANATION:
 * - granted = user has granted permission
 * - denied = user has denied permission
 * - default = user hasn't been asked yet
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 * @returns Promise<boolean> - true if permission was granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('❌ Notifications not supported in this browser');
    return false;
  }
  
  // If we already have permission, return true
  if (Notification.permission === 'granted') {
    console.log('✅ Notification permission already granted');
    return true;
  }
  
  // If it was denied, we can't ask again
  if (Notification.permission === 'denied') {
    console.warn('❌ Notification permission denied by user');
    return false;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('✅ Notification permission granted!');
      return true;
    } else {
      console.warn('❌ Notification permission denied');
      return false;
    }
} catch (error) {
  console.error('Error requesting notification permission:', error);
  return false;
}

}

// ============================================
// SEND NOTIFICATIONS
// ============================================

/**
 * Send a browser notification using the Service Worker when possible.
 * @param payload - Notification payload
 * @returns Promise<boolean> - true if sent successfully
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<boolean> {
  
  // Verificări
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return false;
  }
  
  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return false;
  }
  
  try {
    // If a service worker is active, use it to display the notification (PWA-friendly)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Send via service worker (recommended for PWA)
      const registration = await navigator.serviceWorker.ready;
      
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.svg',
        badge: payload.badge || '/icons/icon-72x72.svg',
        tag: payload.tag || 'rsq-notification',
        data: payload.data,
        requireInteraction: true, // Notificarea rămâne până user-ul dă click
        vibrate: [200, 100, 200], // Vibrație pe mobile
      } as any);
      console.log('✅ Notification sent via Service Worker');
    } else {
      // Fallback: send directly (useful in development)
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.svg',
        tag: payload.tag || 'rsq-notification',
        data: payload.data,
      });
      
      console.log('✅ Notification sent directly');
    }
    
    return true;
    
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

// ============================================
// MATCH NOTIFICATION HELPERS
// ============================================

/**
 * Send a match notification when a match matches filters.
 * @param matchInfo - match information
 * @param filterNames - list of matched filter names
 */
export async function sendMatchNotification(
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    minute?: number;
    matchId: number;
  },
  filterNames: string[]
): Promise<boolean> {
  
  const title = `🎯 R$Q Alert - Match Found!`;
  const body = 
    `⚽ ${matchInfo.homeTeam} vs ${matchInfo.awayTeam}\n` +
    `📊 ${matchInfo.league}\n` +
    `🎯 Filters: ${filterNames.join(', ')}` +
    (matchInfo.minute ? `\n⏱️ ${matchInfo.minute}'` : '');
  
  return await sendNotification({
    title,
    body,
    tag: `match-${matchInfo.matchId}`, // Unique tag per match (prevents duplicates)
    data: {
      type: 'match',
      matchId: matchInfo.matchId,
      filters: filterNames,
    },
  });
}

/**
 * Send a test notification
 */
export async function sendTestNotification(): Promise<boolean> {
  return await sendNotification({
    title: '🎯 R$Q Test Notification',
    body: 'Notifications are working! You will receive alerts when matches match your filters.',
    tag: 'test-notification',
  });
}

// ============================================
// PUSH SUBSCRIPTION HELPERS (Web Push / VAPID)
// ============================================

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe the browser to push notifications and send the subscription to the server.
 * Requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to be set in the client environment.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') {
    const ok = await requestNotificationPermission();
    if (!ok) return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    if (!vapidKey) {
      console.warn('VAPID public key not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY)');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Send subscription to server to save
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, subscription }),
    });

    if (!res.ok) {
      console.error('Failed to save push subscription on server');
      return false;
    }

    console.log('✅ Push subscribed and saved');
    return true;
  } catch (err) {
    console.error('Error subscribing to push:', err);
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      console.log('No push subscription found to unsubscribe');
      return true;
    }

    // Delete on server
    const res = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, endpoint: subscription.endpoint }),
    });

    if (!res.ok) {
      console.error('Failed to remove push subscription on server');
      // continue to unsubscribe locally
    }

    await subscription.unsubscribe();
    console.log('✅ Unsubscribed from push');
    return true;
  } catch (err) {
    console.error('Error unsubscribing from push:', err);
    return false;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if notifications are supported, permitted and ready
 */
export async function checkNotificationStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  ready: boolean;
}> {
  const supported = isNotificationSupported();
  const permission = supported ? getNotificationPermission() : 'denied';
  const ready = supported && permission === 'granted';
  
  return {
    supported,
    permission,
    ready,
  };
}

// ============================================
// EXPORT
// ============================================

const notificationsLib = {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
  sendMatchNotification,
  sendTestNotification,
  checkNotificationStatus,
};

export default notificationsLib;

// ============================================
// USAGE EXAMPLES
// ============================================

/*
import { 
  requestNotificationPermission, 
  sendMatchNotification,
  sendTestNotification 
} from '@/lib/notifications';

// 1. Cere permisiune la început
const hasPermission = await requestNotificationPermission();

if (hasPermission) {
  // 2. Trimite notificare de test
  await sendTestNotification();
  
  // 3. Trimite notificare pentru meci
  await sendMatchNotification(
    {
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      league: 'Premier League',
      minute: 67,
      matchId: 12345,
    },
    ['Cornere Over 8', 'Atacuri Intense']
  );
}
*/
