"use client";

import React, { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
} from "@react-three/postprocessing";
import * as THREE from "three";
import {
  usePerformanceTier,
  getParticleCount,
  getConnectionDistance,
  getMaxConnections,
  type PerformanceTier,
} from "../hooks/usePerformanceTier";

/* ─────────────── Camera Controller ─────────────── */
function CameraController() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const smoothed = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useFrame(() => {
    smoothed.current.x += (mouse.current.x * 0.3 - smoothed.current.x) * 0.02;
    smoothed.current.y += (mouse.current.y * 0.2 - smoothed.current.y) * 0.02;
    camera.position.x = smoothed.current.x;
    camera.position.y = smoothed.current.y;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ─────────────── Particle Field ─────────────── */
function ParticleField({ count, tier }: { count: number; tier: PerformanceTier }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mouse3D = useRef(new THREE.Vector3(0, 0, 0));

  // Initialize particle data
  const particles = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 10 - 2
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.003,
          (Math.random() - 0.5) * 0.003,
          (Math.random() - 0.5) * 0.001
        ),
        baseScale: 0.015 + Math.random() * 0.025,
        pulseSpeed: 0.5 + Math.random() * 2,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    return data;
  }, [count]);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouse3D.current.x = ((e.clientX / window.innerWidth) * 2 - 1) * 6;
      mouse3D.current.y = (-(e.clientY / window.innerHeight) * 2 + 1) * 4;
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      // Drift
      p.position.add(p.velocity);
      // Wrap around boundaries
      if (p.position.x > 8) p.position.x = -8;
      if (p.position.x < -8) p.position.x = 8;
      if (p.position.y > 6) p.position.y = -6;
      if (p.position.y < -6) p.position.y = 6;

      // Mouse attraction (subtle)
      if (tier !== "low") {
        const dx = mouse3D.current.x - p.position.x;
        const dy = mouse3D.current.y - p.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
          const force = (3 - dist) * 0.0004;
          p.position.x += dx * force;
          p.position.y += dy * force;
        }
      }

      // Pulse scale
      const pulse = Math.sin(t * p.pulseSpeed + p.pulsePhase) * 0.3 + 1;
      const scale = p.baseScale * pulse;

      dummy.position.copy(p.position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.7} />
    </instancedMesh>
  );
}

/* ─────────────── Neural Network Lines ─────────────── */
function NeuralNetwork({
  particles,
  connectionDist,
  maxConnections,
}: {
  particles: { position: THREE.Vector3 }[];
  connectionDist: number;
  maxConnections: number;
}) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const positionsArray = useMemo(
    () => new Float32Array(maxConnections * 6),
    [maxConnections]
  );
  const colorsArray = useMemo(
    () => new Float32Array(maxConnections * 6),
    [maxConnections]
  );
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positionsArray, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colorsArray, 3));
    return g;
  }, [positionsArray, colorsArray]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    let idx = 0;
    const t = clock.getElapsedTime();
    const distSq = connectionDist * connectionDist;

    for (let i = 0; i < particles.length && idx < maxConnections; i++) {
      for (let j = i + 1; j < particles.length && idx < maxConnections; j++) {
        const pi = particles[i].position;
        const pj = particles[j].position;
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const dz = pi.z - pj.z;
        const dSq = dx * dx + dy * dy + dz * dz;

        if (dSq < distSq) {
          const alpha = 1 - dSq / distSq;
          const pulse = (Math.sin(t * 2 + i * 0.1) * 0.3 + 0.7) * alpha;

          const base = idx * 6;
          positionsArray[base] = pi.x;
          positionsArray[base + 1] = pi.y;
          positionsArray[base + 2] = pi.z;
          positionsArray[base + 3] = pj.x;
          positionsArray[base + 4] = pj.y;
          positionsArray[base + 5] = pj.z;

          // Cyan to purple gradient
          colorsArray[base] = 0.2 * pulse;
          colorsArray[base + 1] = 0.6 * pulse;
          colorsArray[base + 2] = 1.0 * pulse;
          colorsArray[base + 3] = 0.5 * pulse;
          colorsArray[base + 4] = 0.3 * pulse;
          colorsArray[base + 5] = 0.9 * pulse;

          idx++;
        }
      }
    }

    // Zero out unused
    for (let i = idx * 6; i < maxConnections * 6; i++) {
      positionsArray[i] = 0;
      colorsArray[i] = 0;
    }

    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    geom.setDrawRange(0, idx * 2);
  });

  return (
    <lineSegments ref={lineRef} geometry={geom}>
      <lineBasicMaterial vertexColors transparent opacity={0.35} />
    </lineSegments>
  );
}

/* ─────────────── Data Streams ─────────────── */
function DataStreams({ count = 8 }: { count?: number }) {
  const streams = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const points = [];
      const startX = (Math.random() - 0.5) * 14;
      const startY = (Math.random() - 0.5) * 10;
      const startZ = -3 - Math.random() * 4;
      for (let j = 0; j < 30; j++) {
        points.push(
          new THREE.Vector3(
            startX + Math.sin(j * 0.3 + i) * 1.5,
            startY + j * 0.15,
            startZ + Math.cos(j * 0.2 + i) * 0.5
          )
        );
      }
      arr.push({
        curve: new THREE.CatmullRomCurve3(points),
        speed: 0.3 + Math.random() * 0.4,
        offset: Math.random() * Math.PI * 2,
        color: i % 2 === 0 ? "#818cf8" : "#22d3ee",
      });
    }
    return arr;
  }, [count]);

  return (
    <group>
      {streams.map((stream, i) => (
        <DataStreamLine key={i} stream={stream} />
      ))}
    </group>
  );
}

function DataStreamLine({
  stream,
}: {
  stream: {
    curve: THREE.CatmullRomCurve3;
    speed: number;
    offset: number;
    color: string;
  };
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const progress = ((t * stream.speed + stream.offset) % 1 + 1) % 1;
    const point = stream.curve.getPointAt(progress);
    ref.current.position.copy(point);
    ref.current.scale.setScalar(
      0.03 + Math.sin(t * 4 + stream.offset) * 0.01
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={stream.color} transparent opacity={0.9} />
    </mesh>
  );
}

/* ─────────────── Energy Waves ─────────────── */
function EnergyWaves() {
  const waves = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
        -4
      ),
      delay: i * 3,
    }));
  }, []);

  return (
    <group>
      {waves.map((wave, i) => (
        <EnergyWave key={i} wave={wave} />
      ))}
    </group>
  );
}

function EnergyWave({
  wave,
}: {
  wave: { position: THREE.Vector3; delay: number };
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() + wave.delay) % 8;
    const scale = t * 1.2;
    const opacity = Math.max(0, 1 - t / 8) * 0.15;
    ref.current.scale.setScalar(scale);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity;
  });

  return (
    <mesh ref={ref} position={wave.position} rotation-x={Math.PI / 2}>
      <ringGeometry args={[0.9, 1, 64]} />
      <meshBasicMaterial
        color="#818cf8"
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ─────────────── Floating 3D Objects ─────────────── */
function FloatingObjects({ tier }: { tier: PerformanceTier }) {
  if (tier === "low") return null;

  const objects = useMemo(() => {
    const count = tier === "high" ? 6 : 3;
    return Array.from({ length: count }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        -3 - Math.random() * 4,
      ] as [number, number, number],
      rotation: [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        0,
      ] as [number, number, number],
      scale: 0.15 + Math.random() * 0.25,
      type: i % 3,
      speed: 0.2 + Math.random() * 0.3,
    }));
  }, [tier]);

  return (
    <group>
      {objects.map((obj, i) => (
        <Float
          key={i}
          speed={obj.speed}
          rotationIntensity={0.4}
          floatIntensity={0.6}
          floatingRange={[-0.3, 0.3]}
        >
          <mesh position={obj.position} rotation={obj.rotation} scale={obj.scale}>
            {obj.type === 0 && <icosahedronGeometry args={[1, 0]} />}
            {obj.type === 1 && <octahedronGeometry args={[1, 0]} />}
            {obj.type === 2 && <boxGeometry args={[1, 1, 1]} />}
            <meshBasicMaterial
              color={obj.type === 0 ? "#818cf8" : obj.type === 1 ? "#22d3ee" : "#a78bfa"}
              wireframe
              transparent
              opacity={0.25}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

/* ─────────────── Ambient Light Orbs ─────────────── */
function AmbientOrbs() {
  const orbs = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => ({
      radius: 3 + i * 1.5,
      speed: 0.1 + i * 0.05,
      offset: (i * Math.PI) / 2,
      color: ["#4f46e5", "#7c3aed", "#0ea5e9", "#6366f1"][i],
      size: 0.4 + Math.random() * 0.3,
    }));
  }, []);

  return (
    <group>
      {orbs.map((orb, i) => (
        <AmbientOrb key={i} orb={orb} />
      ))}
    </group>
  );
}

function AmbientOrb({
  orb,
}: {
  orb: {
    radius: number;
    speed: number;
    offset: number;
    color: string;
    size: number;
  };
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * orb.speed + orb.offset;
    ref.current.position.x = Math.cos(t) * orb.radius;
    ref.current.position.y = Math.sin(t * 0.7) * orb.radius * 0.6;
    ref.current.position.z = -5 + Math.sin(t * 0.3) * 2;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[orb.size, 16, 16]} />
      <meshBasicMaterial color={orb.color} transparent opacity={0.06} />
    </mesh>
  );
}

/* ─────────────── Scene (Assembled) ─────────────── */
function Scene({ tier }: { tier: PerformanceTier }) {
  const particleCount = getParticleCount(tier);
  const connectionDist = getConnectionDistance(tier);
  const maxConnections = getMaxConnections(tier);

  // Share particle data between ParticleField and NeuralNetwork
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 10 - 2
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.003,
        (Math.random() - 0.5) * 0.003,
        (Math.random() - 0.5) * 0.001
      ),
      baseScale: 0.015 + Math.random() * 0.025,
      pulseSpeed: 0.5 + Math.random() * 2,
      pulsePhase: Math.random() * Math.PI * 2,
    }));
  }, [particleCount]);

  return (
    <>
      <CameraController />

      {/* Fog for depth */}
      <fog attach="fog" args={["#030712", 5, 20]} />

      {/* Background stars */}
      <Stars
        radius={15}
        depth={50}
        count={tier === "high" ? 3000 : 1500}
        factor={3}
        saturation={0.1}
        fade
        speed={0.5}
      />

      {/* Particles */}
      <ParticleField count={particleCount} tier={tier} />

      {/* Neural network connections */}
      {particleCount > 0 && (
        <NeuralNetwork
          particles={particles}
          connectionDist={connectionDist}
          maxConnections={maxConnections}
        />
      )}

      {/* Data streams */}
      {tier !== "low" && <DataStreams count={tier === "high" ? 8 : 4} />}

      {/* Energy waves */}
      {tier !== "low" && <EnergyWaves />}

      {/* Floating objects */}
      <FloatingObjects tier={tier} />

      {/* Ambient light orbs */}
      {tier !== "low" && <AmbientOrbs />}

      {/* Post-processing */}
      {tier === "high" ? (
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            intensity={1.2}
          />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
          <ChromaticAberration
            offset={new THREE.Vector2(0.0005, 0.0005)}
            radialModulation={true}
            modulationOffset={0.5}
          />
        </EffectComposer>
      ) : tier === "medium" ? (
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            intensity={0.6}
          />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
        </EffectComposer>
      ) : null}
    </>
  );
}

/* ─────────────── Main Export ─────────────── */
export default function NeuralBackground() {
  const tier = usePerformanceTier();

  if (tier === "low") {
    // CSS-only fallback for low-end devices
    return <div className="neural-bg-fallback" />;
  }

  return (
    <div
      className="fixed inset-0 z-0"
      style={{ pointerEvents: "none" }}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={tier === "high" ? [1, 2] : [1, 1.5]}
        gl={{
          antialias: tier === "high",
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <Scene tier={tier} />
      </Canvas>
    </div>
  );
}
