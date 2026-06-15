"use client";

import dynamic from 'next/dynamic';

const Scene3D = dynamic(() => import('@/components/3d/Scene3D'), { ssr: false });
const MouseFollower = dynamic(() => import('@/components/effects/MouseFollower').then(mod => ({ default: mod.MouseFollower })), { ssr: false });
const LoadingAnimation = dynamic(() => import('@/components/effects/LoadingAnimation').then(mod => ({ default: mod.LoadingAnimation })), { ssr: false });
const CinematicDomEffects = dynamic(() => import('@/components/effects/CinematicDomEffects').then(mod => ({ default: mod.CinematicDomEffects })), { ssr: false });

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LoadingAnimation />
      <Scene3D />
      <MouseFollower />
      <CinematicDomEffects />
      {children}
    </>
  );
}
