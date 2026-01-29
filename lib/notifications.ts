// ============================================
// NOTIFICATION HELPERS
// ============================================
// Functions for browser push notifications
// For beginners: learn Notification API, Service Workers

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
 * Check if browser supports notifications
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
 * Request notification permission
 * 
 * @returns Promise<boolean> - true if permission was granted
 * 
 * EXPLANATION:
 * Shows a browser popup with "Allow" or "Block"
 * User decides whether they want notifications
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
 * Trimite o notificare browser
 * 
 * @param payload - Datele notificării
 * @returns Promise<boolean> - true dacă s-a trimis cu succes
 * 
 * EXPLICAȚIE:
 * Creează o notificare care apare în colțul ecranului
 * Pe Windows: colț dreapta-jos
 * Pe Mac: colț dreapta-sus
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
    // Verifică dacă avem service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Trimite prin service worker (mai bun pentru PWA)
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
      // Fallback: trimite direct (pentru testing în development)
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
 * Trimite notificare pentru un meci care match-uiește filtre
 * 
 * @param matchInfo - Info despre meci
 * @param filterNames - Numele filtrelor matched
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
    tag: `match-${matchInfo.matchId}`, // Tag unic per meci (evită duplicate)
    data: {
      type: 'match',
      matchId: matchInfo.matchId,
      filters: filterNames,
    },
  });
}

/**
 * Trimite notificare de test
 */
export async function sendTestNotification(): Promise<boolean> {
  return await sendNotification({
    title: '🎯 R$Q Test Notification',
    body: 'Notifications are working! You will receive alerts when matches match your filters.',
    tag: 'test-notification',
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Verifică dacă notificările sunt permise și funcționale
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

export default {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
  sendMatchNotification,
  sendTestNotification,
  checkNotificationStatus,
};

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
