'use client';

import { useEffect } from 'react';
import '@/src/css/main.css';

export default function Home() {
  useEffect(() => {
    import('@/src/main').then(() => {
      window.updateUI?.();
    });
  }, []);

  return <div id="outerRing"></div>;
}
