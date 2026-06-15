"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { useTestStore } from '@/lib/store';
import { Trophy, Timer, Zap } from 'lucide-react';

function Player({ position, onCollision }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      // Simulate running animation
      meshRef.current.rotation.x += 0.01;
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.5, 32, 32]} position={position}>
      <meshStandardMaterial color="#3b82f6" metalness={0.8} roughness={0.2} />
    </Sphere>
  );
}

function Obstacle({ position, onPass }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.z += 0.1;
      
      // If obstacle passed the player
      if (meshRef.current.position.z > 5) {
        onPass();
        meshRef.current.position.z = -20;
      }
    }
  });

  return (
    <Box ref={meshRef} args={[1, 2, 1]} position={position}>
      <meshStandardMaterial color="#ef4444" />
    </Box>
  );
}

function Track() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <planeGeometry args={[10, 50]} />
      <meshStandardMaterial color="#1f2937" />
    </mesh>
  );
}

export default function TempleRunGame() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0, 2]);
  const [obstacles, setObstacles] = useState([
    { id: 1, position: [-2, 0, -10] as [number, number, number] },
    { id: 2, position: [0, 0, -15] as [number, number, number] },
    { id: 3, position: [2, 0, -20] as [number, number, number] },
  ]);
  const [startTime, setStartTime] = useState<number>(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  
  const { updateGameScore } = useTestStore();

  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      const reactionTime = Date.now() - startTime;
      setReactionTimes(prev => [...prev, reactionTime]);

      if (e.key === 'ArrowLeft') {
        setPlayerPosition(prev => [Math.max(-2, prev[0] - 2), prev[1], prev[2]]);
      } else if (e.key === 'ArrowRight') {
        setPlayerPosition(prev => [Math.min(2, prev[0] + 2), prev[1], prev[2]]);
      } else if (e.key === 'ArrowUp') {
        setPlayerPosition(prev => [prev[0], prev[1] + 2, prev[2]]);
        setTimeout(() => {
          setPlayerPosition(prev => [prev[0], 0, prev[2]]);
        }, 500);
      }
      
      setStartTime(Date.now());
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, startTime]);

  const handleStart = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setStartTime(Date.now());
    setReactionTimes([]);
  };

  const handleObstaclePass = () => {
    setScore(prev => prev + 10);
  };

  const handleGameOver = () => {
    setGameOver(true);
    setGameStarted(false);
    
    const avgReactionTime = reactionTimes.length > 0
      ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
      : 0;
    
    updateGameScore('templeRun', score, avgReactionTime);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-zinc-900 to-black">
      {/* Game Header */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl px-4 py-2 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="text-white font-bold text-lg">{score}</span>
        </div>
        
        {gameStarted && (
          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl px-4 py-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" />
            <span className="text-white text-sm">
              Avg: {reactionTimes.length > 0 
                ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) 
                : 0}ms
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!gameStarted && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 max-w-md text-center space-y-4">
            <h2 className="text-3xl font-bold text-white">Temple Run</h2>
            <p className="text-zinc-400">
              Use arrow keys to dodge obstacles. We'll measure your reaction time!
            </p>
            <div className="space-y-2 text-sm text-zinc-500">
              <div>← → : Move Left/Right</div>
              <div>↑ : Jump</div>
            </div>
            <button
              onClick={handleStart}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 max-w-md text-center space-y-4">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
            <h2 className="text-3xl font-bold text-white">Game Over!</h2>
            <div className="space-y-2">
              <p className="text-zinc-400">Final Score: <span className="text-white font-bold">{score}</span></p>
              <p className="text-zinc-400">
                Avg Reaction: <span className="text-white font-bold">
                  {Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)}ms
                </span>
              </p>
            </div>
            <button
              onClick={handleStart}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[0, 10, 0]} intensity={0.5} />
        
        <Track />
        <Player position={playerPosition} onCollision={handleGameOver} />
        
        {obstacles.map(obstacle => (
          <Obstacle
            key={obstacle.id}
            position={obstacle.position}
            onPass={handleObstaclePass}
          />
        ))}
      </Canvas>
    </div>
  );
}
