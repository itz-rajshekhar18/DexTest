"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { useTestStore } from '@/lib/store';
import { Target, Timer, Zap, Trophy } from 'lucide-react';

function Target3D({ position, onClick, color }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
      meshRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      meshRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      meshRef.current.scale.z = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <Sphere
      ref={meshRef}
      args={[0.5, 32, 32]}
      position={position}
      onClick={onClick}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        metalness={0.8}
        roughness={0.2}
      />
    </Sphere>
  );
}

export default function ReflexGame() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targets, setTargets] = useState<Array<{ id: number; position: [number, number, number]; color: string }>>([]);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetSpawnTime, setTargetSpawnTime] = useState(Date.now());
  
  const { updateGameScore } = useTestStore();

  const spawnTarget = () => {
    const x = (Math.random() - 0.5) * 8;
    const y = (Math.random() - 0.5) * 4;
    const z = (Math.random() - 0.5) * 4;
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    setTargets([{ id: Date.now(), position: [x, y, z], color }]);
    setTargetSpawnTime(Date.now());
  };

  useEffect(() => {
    if (!gameStarted) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleGameEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted]);

  useEffect(() => {
    if (!gameStarted) return;

    const timeout = setTimeout(() => {
      spawnTarget();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [gameStarted, targets]);

  const handleStart = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setTimeLeft(30);
    setReactionTimes([]);
    spawnTarget();
  };

  const handleTargetClick = () => {
    const reactionTime = Date.now() - targetSpawnTime;
    setReactionTimes(prev => [...prev, reactionTime]);
    setScore(prev => prev + 10);
    setTargets([]);
    
    setTimeout(() => {
      spawnTarget();
    }, 500);
  };

  const handleGameEnd = () => {
    setGameOver(true);
    setGameStarted(false);
    
    const avgReactionTime = reactionTimes.length > 0
      ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
      : 0;
    
    updateGameScore('reflexGame', score, avgReactionTime);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900">
      {/* Game Stats */}
      <div className="absolute top-4 left-4 z-10 space-y-2">
        <div className="bg-black/60 backdrop-blur-sm border border-purple-500/50 rounded-xl px-4 py-2 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="text-white font-bold text-lg">{score}</span>
        </div>
        
        <div className="bg-black/60 backdrop-blur-sm border border-purple-500/50 rounded-xl px-4 py-2 flex items-center gap-2">
          <Timer className="w-5 h-5 text-red-500" />
          <span className="text-white font-bold text-lg">{timeLeft}s</span>
        </div>
        
        {reactionTimes.length > 0 && (
          <div className="bg-black/60 backdrop-blur-sm border border-purple-500/50 rounded-xl px-4 py-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" />
            <span className="text-white text-sm">
              {Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)}ms
            </span>
          </div>
        )}
      </div>

      {/* Start Screen */}
      {!gameStarted && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
          <div className="bg-black/80 border border-purple-500/50 rounded-3xl p-8 max-w-md text-center space-y-4">
            <Target className="w-16 h-16 text-purple-500 mx-auto" />
            <h2 className="text-3xl font-bold text-white">Reflex Challenge</h2>
            <p className="text-zinc-400">
              Click the glowing targets as fast as you can! We'll measure your reaction speed.
            </p>
            <button
              onClick={handleStart}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
          <div className="bg-black/80 border border-purple-500/50 rounded-3xl p-8 max-w-md text-center space-y-4">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
            <h2 className="text-3xl font-bold text-white">Time's Up!</h2>
            <div className="space-y-2">
              <p className="text-zinc-400">Targets Hit: <span className="text-white font-bold">{score / 10}</span></p>
              <p className="text-zinc-400">Final Score: <span className="text-white font-bold">{score}</span></p>
              {reactionTimes.length > 0 && (
                <p className="text-zinc-400">
                  Avg Reaction: <span className="text-white font-bold">
                    {Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)}ms
                  </span>
                </p>
              )}
            </div>
            <button
              onClick={handleStart}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8b5cf6" />
        
        {targets.map(target => (
          <Target3D
            key={target.id}
            position={target.position}
            color={target.color}
            onClick={handleTargetClick}
          />
        ))}
      </Canvas>

      {/* Instructions */}
      {gameStarted && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm border border-purple-500/50 rounded-xl px-6 py-3">
          <p className="text-white text-sm font-medium">Click the glowing spheres!</p>
        </div>
      )}
    </div>
  );
}
