"use client";

import React, { useRef, useState, type ReactNode, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  tiltIntensity?: number;
  glowColor?: string;
}

export default function PremiumCard({
  children,
  className = "",
  tiltIntensity = 8,
  glowColor = "rgba(99, 102, 241, 0.15)",
}: PremiumCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Motion values for smooth interpolation
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Spring physics for buttery smooth motion
  const springX = useSpring(mouseX, { stiffness: 150, damping: 20, mass: 0.5 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20, mass: 0.5 });

  // 3D rotation transforms
  const rotateX = useTransform(springY, [0, 1], [tiltIntensity, -tiltIntensity]);
  const rotateY = useTransform(springX, [0, 1], [-tiltIntensity, tiltIntensity]);

  // Dynamic lighting position
  const lightX = useTransform(springX, [0, 1], [0, 100]);
  const lightY = useTransform(springY, [0, 1], [0, 100]);

  // Shadow offset
  const shadowX = useTransform(springX, [0, 1], [10, -10]);
  const shadowY = useTransform(springY, [0, 1], [10, -10]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseX.set(x);
      mouseY.set(y);
    },
    [mouseX, mouseY]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={cardRef}
      className={`premium-card relative ${className}`}
      style={{
        perspective: "1200px",
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative w-full h-full"
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Glass surface */}
        <div
          className="relative w-full rounded-3xl overflow-hidden"
          style={{
            background: "rgba(15, 15, 25, 0.45)",
            backdropFilter: "blur(24px) saturate(1.3)",
            WebkitBackdropFilter: "blur(24px) saturate(1.3)",
            border: "1px solid rgba(99, 102, 241, 0.12)",
            boxShadow: isHovered
              ? `0 25px 60px -12px rgba(0, 0, 0, 0.5), 0 0 40px -8px ${glowColor}`
              : "0 15px 40px -12px rgba(0, 0, 0, 0.4)",
            transition: "box-shadow 0.4s ease",
          }}
        >
          {/* Dynamic light reflection */}
          <motion.div
            className="absolute inset-0 pointer-events-none z-10 rounded-3xl"
            style={{
              background: useTransform(
                [lightX, lightY],
                ([x, y]) =>
                  `radial-gradient(600px circle at ${x}% ${y}%, rgba(129, 140, 248, ${isHovered ? 0.08 : 0.03}), transparent 50%)`
              ),
              transition: "opacity 0.3s ease",
            }}
          />

          {/* Top edge glow */}
          <div
            className="absolute inset-x-0 top-0 h-px z-10"
            style={{
              background: isHovered
                ? "linear-gradient(90deg, transparent 10%, rgba(129, 140, 248, 0.5) 50%, transparent 90%)"
                : "linear-gradient(90deg, transparent 10%, rgba(129, 140, 248, 0.25) 50%, transparent 90%)",
              transition: "background 0.4s ease",
            }}
          />

          {/* Holographic sweep on hover */}
          {isHovered && (
            <div
              className="absolute inset-0 pointer-events-none z-10 rounded-3xl overflow-hidden"
            >
              <div
                className="absolute w-[200%] h-full"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 40%, rgba(165, 180, 252, 0.05) 45%, rgba(196, 181, 253, 0.08) 50%, rgba(165, 180, 252, 0.05) 55%, transparent 60%)",
                  animation: "cardSweep 2s ease-in-out infinite",
                }}
              />
            </div>
          )}

          {/* Card content */}
          <div className="relative z-20 p-8 sm:p-10">
            {children}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
