"use client";

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function NeuralNetwork() {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const { positions, connections } = useMemo(() => {
    const nodeCount = 200; // Increased from 100
    const positions = new Float32Array(nodeCount * 3);
    const connections: number[] = [];

    // Create nodes in 3D space
    for (let i = 0; i < nodeCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }

    // Create connections between nearby nodes
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < 6) { // Increased from 5
          connections.push(i, j);
        }
      }
    }

    return { positions, connections };
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      linesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  const linePositions = useMemo(() => {
    const linePos = new Float32Array(connections.length * 3);
    for (let i = 0; i < connections.length; i++) {
      const nodeIndex = connections[i];
      linePos[i * 3] = positions[nodeIndex * 3];
      linePos[i * 3 + 1] = positions[nodeIndex * 3 + 1];
      linePos[i * 3 + 2] = positions[nodeIndex * 3 + 2];
    }
    return linePos;
  }, [connections, positions]);

  return (
    <group>
      {/* Nodes - Much Brighter */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.3} // Increased from 0.15
          color="#6366f1"
          transparent
          opacity={1} // Increased from 0.8
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Connections - Much Brighter */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePositions.length / 3}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.5} // Increased from 0.2
          blending={THREE.AdditiveBlending}
          linewidth={2}
        />
      </lineSegments>
    </group>
  );
}
