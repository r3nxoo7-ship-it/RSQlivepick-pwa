'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TelegramPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/notifications?tab=telegram');
  }, [router]);
  return null;
}
