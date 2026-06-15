"use client";

import { useState, useEffect } from "react";

export type PerformanceTier = "high" | "medium" | "low";

export function usePerformanceTier(): PerformanceTier {
  const [tier, setTier] = useState<PerformanceTier>("high");

  useEffect(() => {
    // Check for mobile / low-end indicators
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 2;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    const isLowEnd = cores <= 2 || memory <= 2;
    const isMedium = cores <= 4 || memory <= 4;

    if (isMobile || isLowEnd) {
      setTier("low");
    } else if (isMedium) {
      setTier("medium");
    } else {
      setTier("high");
    }
  }, []);

  return tier;
}

export function getParticleCount(tier: PerformanceTier): number {
  switch (tier) {
    case "high": return 400;
    case "medium": return 180;
    case "low": return 0;
  }
}

export function getConnectionDistance(tier: PerformanceTier): number {
  switch (tier) {
    case "high": return 2.5;
    case "medium": return 2.0;
    case "low": return 0;
  }
}

export function getMaxConnections(tier: PerformanceTier): number {
  switch (tier) {
    case "high": return 150;
    case "medium": return 60;
    case "low": return 0;
  }
}
