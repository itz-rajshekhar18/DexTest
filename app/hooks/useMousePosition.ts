"use client";

import { useEffect, useRef, useCallback } from "react";

interface MousePosition {
  x: number; // -1 to 1 (normalized)
  y: number; // -1 to 1 (normalized)
  rawX: number; // pixel position
  rawY: number; // pixel position
}

interface SpringState {
  current: MousePosition;
  target: MousePosition;
  velocity: { x: number; y: number };
}

const SPRING_STIFFNESS = 0.08;
const SPRING_DAMPING = 0.85;

export function useMousePosition() {
  const state = useRef<SpringState>({
    current: { x: 0, y: 0, rawX: 0, rawY: 0 },
    target: { x: 0, y: 0, rawX: 0, rawY: 0 },
    velocity: { x: 0, y: 0 },
  });

  const rafId = useRef<number>(0);
  const listeners = useRef<Set<(pos: MousePosition) => void>>(new Set());

  const subscribe = useCallback((listener: (pos: MousePosition) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const getPosition = useCallback(() => {
    return state.current.current;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      state.current.target = { x: nx, y: ny, rawX: e.clientX, rawY: e.clientY };
    };

    const animate = () => {
      const s = state.current;
      const dx = s.target.x - s.current.x;
      const dy = s.target.y - s.current.y;

      s.velocity.x = (s.velocity.x + dx * SPRING_STIFFNESS) * SPRING_DAMPING;
      s.velocity.y = (s.velocity.y + dy * SPRING_STIFFNESS) * SPRING_DAMPING;

      s.current.x += s.velocity.x;
      s.current.y += s.velocity.y;
      s.current.rawX += (s.target.rawX - s.current.rawX) * 0.1;
      s.current.rawY += (s.target.rawY - s.current.rawY) * 0.1;

      listeners.current.forEach((listener) => listener(s.current));

      rafId.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return { subscribe, getPosition };
}
