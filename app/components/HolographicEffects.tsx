"use client";

import React from "react";

export default function HolographicEffects() {
  return (
    <>
      {/* Scan Lines */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(99, 102, 241, 0.015) 2px, rgba(99, 102, 241, 0.015) 4px)",
          mixBlendMode: "screen",
        }}
      />

      {/* Moving light sweep — horizontal */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none overflow-hidden"
        style={{ mixBlendMode: "screen" }}
      >
        <div
          className="absolute w-[200%] h-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, transparent 40%, rgba(99, 102, 241, 0.03) 49%, rgba(165, 180, 252, 0.06) 50%, rgba(99, 102, 241, 0.03) 51%, transparent 60%, transparent 100%)",
            animation: "lightSweep 8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Ambient glow spots */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        {/* Top-left indigo glow */}
        <div
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(79, 70, 229, 0.08) 0%, transparent 70%)",
            animation: "ambientFloat 12s ease-in-out infinite",
          }}
        />

        {/* Bottom-right purple glow */}
        <div
          className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(124, 58, 237, 0.06) 0%, transparent 70%)",
            animation: "ambientFloat 15s ease-in-out infinite reverse",
          }}
        />

        {/* Center cyan accent */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(34, 211, 238, 0.03) 0%, transparent 60%)",
            animation: "ambientPulse 6s ease-in-out infinite",
          }}
        />
      </div>

      {/* Subtle noise texture */}
      <div
        className="fixed inset-0 z-[3] pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
    </>
  );
}
