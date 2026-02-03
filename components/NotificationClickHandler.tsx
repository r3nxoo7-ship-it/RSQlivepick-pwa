'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Component to handle notification click events
 * Navigates to triggered match details when notification is clicked
 */
export function NotificationClickHandler() {
  const router = useRouter();

  useEffect(() => {
    // Register service worker message handler for notification clicks
    if ('serviceWorker' in navigator) {
      const handleSWMessage = (event: MessageEvent) => {
        console.log('📢 Message from Service Worker:', event.data);
        
        // Handle notification click action
        if (event.data?.type === 'notificationclick') {
          const { triggeredMatchId } = event.data;
          console.log('🎯 Notification clicked! Triggered Match ID:', triggeredMatchId);
          
          if (triggeredMatchId) {
            // Use a small delay to ensure the app is ready
            setTimeout(() => {
              router.push(`/dashboard/triggered/${triggeredMatchId}`);
            }, 100);
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSWMessage as EventListener);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage as EventListener);
      };
    }

    // Also check session storage for notification click data (fallback)
    const checkForNotificationClick = () => {
      try {
        const lastClick = sessionStorage.getItem('lastNotificationClick');
        if (lastClick) {
          const { triggeredMatchId, timestamp } = JSON.parse(lastClick);
          
          // Only redirect if click happened recently (within 5 seconds)
          if (Date.now() - timestamp < 5000) {
            console.log('🎯 Redirecting to triggered match from session storage:', triggeredMatchId);
            router.push(`/dashboard/triggered/${triggeredMatchId}`);
            sessionStorage.removeItem('lastNotificationClick');
          }
        }
      } catch (err) {
        console.error('Error checking notification click:', err);
      }
    };

    // Check on component mount
    checkForNotificationClick();

    // Also listen for visibility changes (app came to foreground from notification)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForNotificationClick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  return null;
}
