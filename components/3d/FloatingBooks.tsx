"use client";

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';

export function FloatingBook({ position, rotation, color, text }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const speed = Math.random() * 0.5 + 0.5;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01 * speed;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * speed) * 0.002;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <Box ref={meshRef} args={[1.5, 2, 0.3]}>
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
      </Box>
      <Box position={[0, 0, 0.16]} args={[1.4, 1.9, 0.05]}>
        <meshStandardMaterial color="white" />
      </Box>
    </group>
  );
}

export function FloatingBooks() {
  const books = [
    { position: [-5, 2, -5], rotation: [0.2, 0.3, 0.1], color: '#6366f1', text: 'IQ' },
    { position: [5, 1, -3], rotation: [-0.1, -0.4, 0.2], color: '#8b5cf6', text: 'MATH' },
    { position: [-3, -1, -4], rotation: [0.3, 0.2, -0.1], color: '#ec4899', text: 'LOGIC' },
    { position: [4, -2, -6], rotation: [-0.2, 0.5, 0.2], color: '#3b82f6', text: 'BRAIN' },
    { position: [0, 3, -8], rotation: [0.1, -0.3, 0.1], color: '#10b981', text: 'TEST' },
    { position: [-6, -3, -7], rotation: [0.4, 0.1, -0.2], color: '#f59e0b', text: 'QUIZ' },
  ];

  return (
    <group>
      {books.map((book, index) => (
        <FloatingBook key={index} {...book} />
      ))}
    </group>
  );
}
