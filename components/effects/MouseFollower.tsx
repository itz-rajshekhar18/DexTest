"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function MouseFollower() {
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const core = coreRef.current;
    const halo = haloRef.current;
    const aura = auraRef.current;
    if (!core || !halo || !aura) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.set([core, halo, aura], { xPercent: -50, yPercent: -50 });

    const moveCoreX = gsap.quickTo(core, "x", { duration: 0.08, ease: "power2.out" });
    const moveCoreY = gsap.quickTo(core, "y", { duration: 0.08, ease: "power2.out" });
    const moveHaloX = gsap.quickTo(halo, "x", { duration: reduceMotion ? 0 : 0.32, ease: "power3.out" });
    const moveHaloY = gsap.quickTo(halo, "y", { duration: reduceMotion ? 0 : 0.32, ease: "power3.out" });
    const moveAuraX = gsap.quickTo(aura, "x", { duration: reduceMotion ? 0 : 0.75, ease: "power3.out" });
    const moveAuraY = gsap.quickTo(aura, "y", { duration: reduceMotion ? 0 : 0.75, ease: "power3.out" });

    const onMove = (event: MouseEvent) => {
      const x = event.clientX;
      const y = event.clientY;

      moveCoreX(x);
      moveCoreY(y);
      moveHaloX(x);
      moveHaloY(y);
      moveAuraX(x);
      moveAuraY(y);

      document.documentElement.style.setProperty("--cursor-x", `${x}px`);
      document.documentElement.style.setProperty("--cursor-y", `${y}px`);
    };

    const onOver = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const active = Boolean(target?.closest("button, a[href], [role='button'], input, select, textarea"));
      gsap.to(halo, {
        scale: active ? 1.75 : 1,
        opacity: active ? 0.72 : 0.42,
        duration: 0.35,
        ease: "power3.out",
      });
      gsap.to(core, {
        scale: active ? 0.75 : 1,
        opacity: active ? 0.95 : 0.75,
        duration: 0.35,
        ease: "power3.out",
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, []);

  return (
    <>
      <div ref={auraRef} className="ai-cursor-aura" />
      <div ref={haloRef} className="ai-cursor-halo" />
      <div ref={coreRef} className="ai-cursor-core" />
    </>
  );
}
