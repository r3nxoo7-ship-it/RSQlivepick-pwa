// ============================================
// CUSTOM SERVICE WORKER - NOTIFICATION HANDLERS
// ============================================
// This file adds notification click handling to the PWA

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification);

  // Close the notification
  event.notification.close();

  // Get data from the notification
  const data = event.notification.data || {};
  const triggeredMatchId = data.triggeredMatchId;

  // Determine which URL to open
  let urlToOpen = data.url || '/dashboard/live';

  if (triggeredMatchId) {
    // If we have a triggered match ID, go directly to that match details
    urlToOpen = `/dashboard/triggered/${triggeredMatchId}`;
  }

  console.log('🔔 Opening URL:', urlToOpen);

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            // App is already open, focus it and navigate
            console.log('🔔 Focusing existing window and navigating');
            return client.focus().then((focusedClient) => {
              if (focusedClient && 'navigate' in focusedClient) {
                return focusedClient.navigate(urlToOpen);
              }
              return focusedClient;
            });
          }
        }

        // App not open, open a new window
        console.log('🔔 Opening new window');
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('🔔 Error handling notification click:', error);
      })
  );
});

// Handle notification close events (optional analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('🔔 Notification closed without interaction');
});

// Handle push events (show notification)
self.addEventListener('push', (event) => {
  console.log('🔔 Push event received:', event);

  if (!event.data) {
    console.log('🔔 Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('🔔 Push data:', data);

    const title = data.title || 'R$Q Alert';
    const options = {
      body: data.body || 'New match alert!',
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-96x96.svg',
      data: {
        triggeredMatchId: data.triggeredMatchId,
        matchId: data.matchId,
        filterId: data.filterId,
        url: data.url || '/dashboard/history',
      },
      actions: data.actions || [
        { action: 'open', title: 'View' },
        { action: 'close', title: 'Dismiss' }
      ],
      tag: data.tag || 'rsq-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('🔔 Error parsing push data:', error);
  }
});

console.log('✅ Custom service worker loaded with notification handlers');
