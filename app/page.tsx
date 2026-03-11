'use client';

import { useEffect } from 'react';
import '@/src/css/main.css';

export default function Home() {
  useEffect(() => {
    import('@/src/main').then((mod) => {
      if (typeof (window as any).updateUI === 'function') {
        (window as any).updateUI();
      }
    });
  }, []);

  return <div id="outerRing"></div>;
}
