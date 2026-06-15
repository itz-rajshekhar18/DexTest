"use client";

import dynamic from 'next/dynamic';

const ReflexGame = dynamic(() => import('@/components/games/ReflexGame'), {
  ssr: false,
});

export default function ReflexGamePage() {
  return <ReflexGame />;
}
