"use client";

/* eslint-disable react-hooks/immutability, react-hooks/purity */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

type Tier = "high" | "medium" | "low";

type NodePoint = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  pulse: number;
  size: number;
};

function getTier(): Tier {
  if (typeof navigator === "undefined") return "medium";
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;

  if (isMobile || cores <= 2 || memory <= 2) return "low";
  if (cores <= 4 || memory <= 4) return "medium";
  return "high";
}

function usePointerAndScroll() {
  const state = useRef({ x: 0, y: 0, sx: 0, sy: 0, scroll: 0 });

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      state.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      state.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    const onScroll = () => {
      const max = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      state.current.scroll = window.scrollY / max;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return state;
}

function CameraRig({ tracker }: { tracker: ReturnType<typeof usePointerAndScroll> }) {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const target = tracker.current;
    target.sx += (target.x - target.sx) * 0.035;
    target.sy += (target.y - target.sy) * 0.035;

    const drift = clock.elapsedTime * 0.12;
    camera.position.x = target.sx * 0.9 + Math.sin(drift) * 0.16;
    camera.position.y = target.sy * 0.55 + Math.cos(drift * 0.8) * 0.12;
    camera.position.z = 9.2 - target.scroll * 1.25 + Math.sin(drift * 0.7) * 0.16;
    camera.rotation.z = target.sx * -0.012;
    camera.lookAt(target.sx * 0.35, target.sy * 0.22, -1.8);
  });

  return null;
}

function NeuralField({ tier, tracker }: { tier: Tier; tracker: ReturnType<typeof usePointerAndScroll> }) {
  const nodeCount = tier === "high" ? 360 : 190;
  const maxConnections = tier === "high" ? 980 : 420;
  const pointRef = useRef<THREE.Points>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const pulseRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const nodes = useMemo<NodePoint[]>(() => {
    return Array.from({ length: nodeCount }, (_, index) => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 26,
        (Math.random() - 0.5) * 16,
        -2 - Math.random() * 16
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.005,
        (Math.random() - 0.5) * 0.004
      ),
      pulse: Math.random() * Math.PI * 2 + index * 0.01,
      size: 0.035 + Math.random() * 0.045,
    }));
  }, [nodeCount]);

  const pointPositions = useMemo(() => new Float32Array(nodeCount * 3), [nodeCount]);
  const pointColors = useMemo(() => new Float32Array(nodeCount * 3), [nodeCount]);
  const linePositions = useMemo(() => new Float32Array(maxConnections * 6), [maxConnections]);
  const lineColors = useMemo(() => new Float32Array(maxConnections * 6), [maxConnections]);
  const pulsePairs = useMemo(() => {
    return Array.from({ length: tier === "high" ? 32 : 16 }, () => ({
      from: Math.floor(Math.random() * nodeCount),
      to: Math.floor(Math.random() * nodeCount),
      speed: 0.16 + Math.random() * 0.26,
      offset: Math.random(),
    }));
  }, [nodeCount, tier]);

  const pointGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));
    return geometry;
  }, [pointColors, pointPositions]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    return geometry;
  }, [lineColors, linePositions]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const pointerX = tracker.current.sx * 4.5;
    const pointerY = tracker.current.sy * 3.2;
    const connectionDistance = tier === "high" ? 3.15 : 2.75;
    const connectionDistanceSq = connectionDistance * connectionDistance;
    let connectionIndex = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      node.position.add(node.velocity);

      const dx = pointerX - node.position.x;
      const dy = pointerY - node.position.y;
      const pointerDist = Math.sqrt(dx * dx + dy * dy);
      if (pointerDist < 4.2) {
        const force = (4.2 - pointerDist) * 0.0009;
        node.position.x += dx * force;
        node.position.y += dy * force;
      }

      if (node.position.x > 13) node.position.x = -13;
      if (node.position.x < -13) node.position.x = 13;
      if (node.position.y > 8) node.position.y = -8;
      if (node.position.y < -8) node.position.y = 8;
      if (node.position.z > 1) node.position.z = -18;
      if (node.position.z < -18) node.position.z = 1;

      const base = i * 3;
      const brightness = 0.55 + Math.sin(time * 1.6 + node.pulse) * 0.32;
      pointPositions[base] = node.position.x;
      pointPositions[base + 1] = node.position.y;
      pointPositions[base + 2] = node.position.z;
      pointColors[base] = 0.22 + brightness * 0.18;
      pointColors[base + 1] = 0.66 + brightness * 0.18;
      pointColors[base + 2] = 1;
    }

    for (let i = 0; i < nodes.length && connectionIndex < maxConnections; i++) {
      for (let j = i + 1; j < nodes.length && connectionIndex < maxConnections; j += 2) {
        const a = nodes[i].position;
        const b = nodes[j].position;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < connectionDistanceSq) {
          const alpha = 1 - distSq / connectionDistanceSq;
          const pulse = alpha * (0.35 + Math.sin(time * 2.2 + i * 0.07) * 0.16);
          const base = connectionIndex * 6;

          linePositions[base] = a.x;
          linePositions[base + 1] = a.y;
          linePositions[base + 2] = a.z;
          linePositions[base + 3] = b.x;
          linePositions[base + 4] = b.y;
          linePositions[base + 5] = b.z;

          lineColors[base] = 0.18 * pulse;
          lineColors[base + 1] = 0.74 * pulse;
          lineColors[base + 2] = 1 * pulse;
          lineColors[base + 3] = 0.72 * pulse;
          lineColors[base + 4] = 0.32 * pulse;
          lineColors[base + 5] = 1 * pulse;
          connectionIndex++;
        }
      }
    }

    lineGeometry.setDrawRange(0, connectionIndex * 2);
    pointGeometry.attributes.position.needsUpdate = true;
    pointGeometry.attributes.color.needsUpdate = true;
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;

    if (pulseRef.current) {
      for (let i = 0; i < pulsePairs.length; i++) {
        const pair = pulsePairs[i];
        if (pair.from === pair.to) pair.to = (pair.to + 11) % nodes.length;

        const progress = (time * pair.speed + pair.offset) % 1;
        const from = nodes[pair.from].position;
        const to = nodes[pair.to].position;
        dummy.position.lerpVectors(from, to, progress);
        dummy.scale.setScalar(0.045 + Math.sin(progress * Math.PI) * 0.085);
        dummy.updateMatrix();
        pulseRef.current.setMatrixAt(i, dummy.matrix);
      }
      pulseRef.current.instanceMatrix.needsUpdate = true;
    }

    if (pointRef.current) pointRef.current.rotation.y = Math.sin(time * 0.08) * 0.04;
    if (lineRef.current) lineRef.current.rotation.y = Math.sin(time * 0.08) * 0.04;
  });

  return (
    <group>
      <points ref={pointRef} geometry={pointGeometry}>
        <pointsMaterial
          size={0.055}
          vertexColors
          transparent
          opacity={0.86}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <lineSegments ref={lineRef} geometry={lineGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.58} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={pulseRef} args={[undefined, undefined, pulsePairs.length]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function DataStreams({ tier }: { tier: Tier }) {
  const count = tier === "high" ? 9 : 5;
  const streams = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const points = Array.from({ length: 18 }, (_, j) => {
        const y = -7 + j * 0.85;
        return new THREE.Vector3(
          -11 + i * (22 / Math.max(count - 1, 1)) + Math.sin(j * 0.7 + i) * 0.8,
          y,
          -8 - Math.cos(j * 0.45 + i) * 2
        );
      });
      return {
        curve: new THREE.CatmullRomCurve3(points),
        offset: Math.random(),
        speed: 0.08 + Math.random() * 0.1,
        color: i % 3 === 0 ? "#22d3ee" : i % 3 === 1 ? "#818cf8" : "#c084fc",
      };
    });
  }, [count]);

  return (
    <group>
      {streams.map((stream, index) => (
        <StreamPulse key={index} stream={stream} />
      ))}
    </group>
  );
}

function StreamPulse({ stream }: { stream: { curve: THREE.CatmullRomCurve3; offset: number; speed: number; color: string } }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const progress = (clock.elapsedTime * stream.speed + stream.offset) % 1;
    ref.current.position.copy(stream.curve.getPointAt(progress));
    ref.current.scale.setScalar(0.07 + Math.sin(progress * Math.PI) * 0.1);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color={stream.color} transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function EnergyWaves() {
  const waves = useMemo(
    () => [
      { position: [-5.5, -2.6, -8] as [number, number, number], delay: 0, color: "#22d3ee" },
      { position: [4.8, 2.7, -10] as [number, number, number], delay: 2.3, color: "#818cf8" },
      { position: [0, 0.5, -13] as [number, number, number], delay: 4.6, color: "#c084fc" },
    ],
    []
  );

  return (
    <group>
      {waves.map((wave, index) => (
        <Wave key={index} {...wave} />
      ))}
    </group>
  );
}

function Wave({ position, delay, color }: { position: [number, number, number]; delay: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = (clock.elapsedTime + delay) % 7;
    const material = ref.current.material as THREE.MeshBasicMaterial;
    ref.current.scale.setScalar(0.4 + time * 1.2);
    material.opacity = Math.max(0, 0.2 - time * 0.026);
  });

  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2.8, 0, 0]}>
      <ringGeometry args={[0.9, 0.93, 96]} />
      <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function FloatingObjects({ tier }: { tier: Tier }) {
  const objects = useMemo(() => {
    const count = tier === "high" ? 8 : 5;
    return Array.from({ length: count }, (_, index) => ({
      position: [
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 10,
        -5 - Math.random() * 11,
      ] as [number, number, number],
      scale: 0.32 + Math.random() * 0.46,
      type: index % 4,
      color: ["#60a5fa", "#22d3ee", "#a78bfa", "#f8fafc"][index % 4],
      speed: 0.35 + Math.random() * 0.45,
    }));
  }, [tier]);

  return (
    <group>
      {objects.map((object, index) => (
        <Float key={index} speed={object.speed} rotationIntensity={0.45} floatIntensity={0.55} floatingRange={[-0.28, 0.28]}>
          <mesh position={object.position} scale={object.scale}>
            {object.type === 0 && <icosahedronGeometry args={[1, 1]} />}
            {object.type === 1 && <octahedronGeometry args={[1, 0]} />}
            {object.type === 2 && <boxGeometry args={[1, 1, 1, 2, 2, 2]} />}
            {object.type === 3 && <torusKnotGeometry args={[0.7, 0.13, 64, 8]} />}
            <meshBasicMaterial color={object.color} wireframe transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function Scene({ tier, tracker }: { tier: Tier; tracker: ReturnType<typeof usePointerAndScroll> }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={62} />
      <CameraRig tracker={tracker} />
      <fog attach="fog" args={["#030712", 6, 22]} />

      <ambientLight intensity={0.38} />
      <pointLight position={[7, 4, 3]} intensity={1.3} color="#38bdf8" />
      <pointLight position={[-7, -3, -2]} intensity={1} color="#8b5cf6" />

      <NeuralField tier={tier} tracker={tracker} />
      {tier !== "low" && <DataStreams tier={tier} />}
      {tier !== "low" && <EnergyWaves />}
      {tier !== "low" && <FloatingObjects tier={tier} />}

      {tier !== "low" && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={tier === "high" ? 0.95 : 0.65} luminanceThreshold={0.18} luminanceSmoothing={0.82} mipmapBlur />
          <DepthOfField focusDistance={0.02} focalLength={0.018} bokehScale={tier === "high" ? 1.2 : 0.7} />
          <Vignette offset={0.08} darkness={0.72} />
        </EffectComposer>
      )}
    </>
  );
}

export default function Scene3D() {
  const [tier] = useState<Tier>(() => getTier());
  const tracker = usePointerAndScroll();

  if (tier === "low") {
    return (
      <div className="ai-scene-fallback fixed inset-0 pointer-events-none z-[3]" aria-hidden="true" />
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[3] opacity-100" aria-hidden="true">
      <Canvas
        dpr={tier === "high" ? [1, 1.65] : [1, 1.25]}
        gl={{
          alpha: true,
          antialias: tier === "high",
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 0, 9], fov: 62 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene tier={tier} tracker={tracker} />
        </Suspense>
      </Canvas>
    </div>
  );
}
