# Web Push Notifications - VAPID Setup

## Issue Fixed
The "Could not subscribe to push" error was occurring because VAPID keys were not configured.

## VAPID Keys Generated
```
Public Key: BA3_RidJB0B-0gqbEAC81NRD9Z2KX7zM6Sm-R7dMG_FzllCsYtwOxHQs_5QteX0onRDouv3kTgHn50BbRQu4JTQ
Private Key: IY30ns6pWB76dcGPfOlIu7DiKHJfObGpE50Piq3ThKQ
```

## Configuration Steps

### 1. Local Development (Already Done)
- Added to `.env.local`:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (for browser)
  - `VAPID_PRIVATE_KEY` (for server)

### 2. Vercel Production (REQUIRED)
You must add these environment variables to your Vercel project:

1. Go to: https://vercel.com/r3nxos-projects/rs-qlivepick-pwa/settings/environment-variables
2. Add two environment variables:
   - Name: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
     Value: `BA3_RidJB0B-0gqbEAC81NRD9Z2KX7zM6Sm-R7dMG_FzllCsYtwOxHQs_5QteX0onRDouv3kTgHn50BbRQu4JTQ`
     Environments: Production, Preview, Development
   
   - Name: `VAPID_PRIVATE_KEY`
     Value: `IY30ns6pWB76dcGPfOlIu7DiKHJfObGpE50Piq3ThKQ`
     Environments: Production, Preview, Development

3. Redeploy your project after adding these variables

## How It Works
- The public key is sent to browsers so they can subscribe to push notifications
- The private key stays on the server and signs push notifications
- Web Push API uses these keys to securely deliver notifications

## Testing
After adding Vercel env vars and redeploying:
1. Go to https://rs-qlivepick-pwa.vercel.app/dashboard/notifications
2. Click "Enable Push Notifications"
3. Grant browser permission when prompted
4. Click "Subscribe to Push" - should now succeed
