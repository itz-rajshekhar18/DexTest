"use client";

import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Neural network nodes
    const nodes: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      targetAlpha: number;
      connections: number[];
      active: boolean;
      activatedAt: number;
    }[] = [];

    const nodeCount = 60;
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 1.5 + Math.random() * 2,
        alpha: 0,
        targetAlpha: 0,
        connections: [],
        active: false,
        activatedAt: 0,
      });
    }

    // Data pulses
    const pulses: {
      fromIdx: number;
      toIdx: number;
      progress: number;
      speed: number;
      active: boolean;
    }[] = [];

    let animProgress = 0;
    let animFrame: number;

    function drawFrame(time: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update nodes
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
        node.alpha += (node.targetAlpha - node.alpha) * 0.08;
      }

      // Draw connections
      const maxDist = 180;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha =
              (1 - dist / maxDist) *
              0.3 *
              Math.min(nodes[i].alpha, nodes[j].alpha);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw data pulses
      for (const pulse of pulses) {
        if (!pulse.active) continue;
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulse.active = false;
          continue;
        }
        const from = nodes[pulse.fromIdx];
        const to = nodes[pulse.toIdx];
        const px = from.x + (to.x - from.x) * pulse.progress;
        const py = from.y + (to.y - from.y) * pulse.progress;

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 6);
        gradient.addColorStop(0, `rgba(129, 140, 248, ${0.9 * from.alpha})`);
        gradient.addColorStop(1, `rgba(129, 140, 248, 0)`);
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.alpha < 0.01) continue;

        // Glow
        const glow = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius * 4
        );
        glow.addColorStop(
          0,
          `rgba(99, 102, 241, ${0.4 * node.alpha})`
        );
        glow.addColorStop(1, "rgba(99, 102, 241, 0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(165, 180, 252, ${node.alpha})`;
        ctx.fill();
      }

      animFrame = requestAnimationFrame(drawFrame);
    }

    animFrame = requestAnimationFrame(drawFrame);

    // GSAP Timeline
    const tl = gsap.timeline({
      onComplete: () => {
        setReady(true);
      },
    });

    // Phase 1: Nodes appear (0 → 0.8s)
    tl.to(
      {},
      {
        duration: 0.8,
        onUpdate: function () {
          const progress = this.progress();
          const count = Math.floor(progress * nodeCount);
          for (let i = 0; i < count; i++) {
            nodes[i].targetAlpha = 1;
          }
        },
      }
    );

    // Phase 2: Connections activate + pulses (0.8 → 1.8s)
    tl.to(
      {},
      {
        duration: 1,
        onUpdate: function () {
          if (Math.random() < 0.15) {
            const from = Math.floor(Math.random() * nodeCount);
            const to = Math.floor(Math.random() * nodeCount);
            if (from !== to) {
              pulses.push({
                fromIdx: from,
                toIdx: to,
                progress: 0,
                speed: 0.02 + Math.random() * 0.03,
                active: true,
              });
            }
          }
        },
      }
    );

    // Phase 3: Logo appears (1.8 → 2.5s)
    tl.to(
      logoRef.current,
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
      },
      "+=0"
    );

    // Phase 3b: Subtitle appears
    tl.to(
      subtitleRef.current,
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power3.out",
      },
      "-=0.2"
    );

    // Phase 4: Progress bar fills (2.5 → 3.2s)
    tl.to(
      progressRef.current?.querySelector(".progress-fill") || {},
      {
        scaleX: 1,
        duration: 0.7,
        ease: "power2.inOut",
      },
      "-=0.1"
    );

    // Phase 5: Hold briefly then fade out (3.2 → 3.8s)
    tl.to({}, { duration: 0.3 });

    return () => {
      cancelAnimationFrame(animFrame);
      tl.kill();
    };
  }, []);

  // Fade out after ready
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    gsap.to(containerRef.current, {
      opacity: 0,
      duration: 0.6,
      ease: "power2.inOut",
      onComplete: onComplete,
    });
  }, [ready, onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "#030712" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center gap-4">
        <div
          ref={logoRef}
          className="text-4xl sm:text-5xl font-extrabold tracking-tight"
          style={{
            opacity: 0,
            transform: "translateY(20px)",
            background:
              "linear-gradient(135deg, #818cf8 0%, #c4b5fd 30%, #e0e7ff 50%, #818cf8 70%, #6366f1 100%)",
            backgroundSize: "200% 200%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s ease-in-out infinite",
          }}
        >
          DexTest
        </div>

        <div
          ref={subtitleRef}
          className="text-sm text-indigo-300/60 tracking-[0.3em] uppercase font-medium"
          style={{ opacity: 0, transform: "translateY(10px)" }}
        >
          Initializing Neural Interface
        </div>

        <div
          ref={progressRef}
          className="w-48 h-0.5 bg-zinc-800/50 rounded-full overflow-hidden mt-2"
        >
          <div
            className="progress-fill h-full rounded-full origin-left"
            style={{
              transform: "scaleX(0)",
              background:
                "linear-gradient(90deg, #4f46e5, #818cf8, #c4b5fd)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
