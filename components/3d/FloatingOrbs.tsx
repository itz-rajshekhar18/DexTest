"use client";

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

export function FloatingOrb({ position, color, speed = 1 }: any) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.5;
      meshRef.current.rotation.x += 0.01 * speed;
      meshRef.current.rotation.y += 0.02 * speed;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 32, 32]} position={position}>
      <MeshDistortMaterial
        color={color}
        attach="material"
        distort={0.3}
        speed={2}
        roughness={0}
        metalness={0.8}
        emissive={color}
        emissiveIntensity={0.5}
      />
    </Sphere>
  );
}

export function FloatingOrbs() {
  const orbs = [
    { position: [-3, 2, -2], color: '#6366f1', speed: 1 },
    { position: [3, 1, -3], color: '#8b5cf6', speed: 0.8 },
    { position: [0, -1, -4], color: '#ec4899', speed: 1.2 },
    { position: [-2, -2, -1], color: '#3b82f6', speed: 0.9 },
    { position: [2, 3, -5], color: '#10b981', speed: 1.1 },
  ];

  return (
    <group>
      {orbs.map((orb, index) => (
        <FloatingOrb key={index} {...orb} />
      ))}
    </group>
  );
}
