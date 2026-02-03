'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to handle notification clicks
 * Navigates to triggered match details page when notification is clicked
 */
export function useNotificationClickHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle notification click event when user comes from notification
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📢 Message from SW:', event.data);
        
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          const { triggeredMatchId, url } = event.data;
          
          if (triggeredMatchId) {
            console.log(`🎯 Navigating to triggered match: ${triggeredMatchId}`);
            router.push(`/dashboard/triggered/${triggeredMatchId}`);
          } else if (url) {
            console.log(`🎯 Navigating to: ${url}`);
            router.push(url);
          }
        }
      });
    }

    // Also listen for notification clicks if we're in a browser that supports it
    if ('Notification' in window) {
      // This won't work in all cases since the service worker handles the click
      // But we can use this as a fallback
    }
  }, [router]);
}

/**
 * Hook to show notification click to user
 * This runs in the main app and listens for client-side navigation triggers
 */
export function useNotificationNavigation() {
  useEffect(() => {
    // Check if we navigated here from a notification (using search params)
    const params = new URLSearchParams(window.location.search);
    const fromNotification = params.get('from_notification');
    
    if (fromNotification === 'true') {
      console.log('📬 Navigated from notification');
      // You can show a toast here if needed
    }
  }, []);
}
