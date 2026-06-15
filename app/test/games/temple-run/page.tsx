"use client";

import dynamic from 'next/dynamic';

const TempleRunGame = dynamic(() => import('@/components/games/TempleRunGame'), {
  ssr: false,
});

export default function TempleRunPage() {
  return <TempleRunGame />;
}
