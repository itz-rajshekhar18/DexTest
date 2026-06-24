"use client";

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import { isTestCompleted, useTestStore } from '@/lib/store';
import { gameIQAgent } from '@/lib/aiAgents';
import { ArrowRight, Crosshair, Timer, Zap, Trophy } from 'lucide-react';

function Target3D({
  position,
  velocity,
  onClick,
  color,
}: {
  position: [number, number, number];
  velocity: [number, number, number];
  onClick: () => void;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const velocityRef = useRef(new THREE.Vector3(...velocity));
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.add(velocityRef.current);
      if (Math.abs(meshRef.current.position.x) > 4.2) velocityRef.current.x *= -1;
      if (Math.abs(meshRef.current.position.y) > 2.3) velocityRef.current.y *= -1;
      if (Math.abs(meshRef.current.position.z) > 2.4) velocityRef.current.z *= -1;
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
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.025, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
    </Sphere>
  );
}

export default function ReflexGame() {
  const router = useRouter();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targets, setTargets] = useState<Array<{ id: number; position: [number, number, number]; velocity: [number, number, number]; color: string }>>([]);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [agentSignal, setAgentSignal] = useState('Waiting for reaction data.');
  const targetSpawnTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const gameEndHandledRef = useRef(false);
  
  const { setTestType, updateGameScore } = useTestStore();

  useEffect(() => {
    setTestType('game');
    if (isTestCompleted('game')) {
      router.replace('/test');
    }
  }, [router, setTestType]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    reactionTimesRef.current = reactionTimes;
  }, [reactionTimes]);

  useEffect(() => {
    if (!gameStarted && !gameOver) return;

    const averageReactionTime =
      reactionTimes.length > 0
        ? Math.round(reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length)
        : 0;

    updateGameScore('reflexGame', score, averageReactionTime);
  }, [gameOver, gameStarted, reactionTimes, score, updateGameScore]);

  const spawnTarget = () => {
    const x = (Math.random() - 0.5) * 8;
    const y = (Math.random() - 0.5) * 4;
    const z = (Math.random() - 0.5) * 4;
    const velocity: [number, number, number] = [
      (Math.random() - 0.5) * 0.035,
      (Math.random() - 0.5) * 0.03,
      (Math.random() - 0.5) * 0.025,
    ];
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    setTargets([{ id: Date.now(), position: [x, y, z], velocity, color }]);
    targetSpawnTimeRef.current = Date.now();
  };

  const handleGameEnd = useCallback(() => {
    if (gameEndHandledRef.current) return;

    gameEndHandledRef.current = true;
    setGameOver(true);
    setGameStarted(false);
    setTargets([]);

    const assessment = gameIQAgent.assessReflexGame(scoreRef.current, reactionTimesRef.current);
    setAgentSignal(assessment.cognitiveSignal);
    updateGameScore('reflexGame', assessment.score, assessment.avgReactionTime);
  }, [updateGameScore]);

  useEffect(() => {
    if (!gameStarted) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted]);

  useEffect(() => {
    if (!gameStarted || timeLeft > 0) return;

    handleGameEnd();
  }, [gameStarted, handleGameEnd, timeLeft]);

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
    setAgentSignal('Collecting reaction data.');
    gameEndHandledRef.current = false;
    spawnTarget();
  };

  const handleTargetClick = () => {
    const reactionTime = Date.now() - targetSpawnTimeRef.current;
    setReactionTimes(prev => [...prev, reactionTime]);
    setScore(prev => prev + 10);
    setTargets([]);
    
    setTimeout(() => {
      spawnTarget();
    }, 500);
  };

  const handleViewResults = () => {
    router.push('/test/results');
  };

  return (
    <div className="w-full h-screen bg-[radial-gradient(circle_at_50%_20%,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,#111827,#020617_48%,#1e1b4b)]">
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
          <div className="bg-black/75 border border-purple-300/30 rounded-3xl p-8 max-w-md text-center space-y-5 shadow-2xl shadow-purple-500/20 backdrop-blur-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-purple-300/25 bg-purple-400/10">
              <Crosshair className="w-11 h-11 text-purple-200" />
            </div>
            <h2 className="text-3xl font-bold text-white">Reflex Challenge</h2>
            <p className="text-zinc-400">
              Click the glowing targets as fast as you can! We&apos;ll measure your reaction speed.
            </p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-purple-100">
              Powered by {gameIQAgent.name}
            </div>
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
          <div className="bg-black/80 border border-purple-500/50 rounded-3xl p-8 max-w-md text-center space-y-4 shadow-2xl shadow-purple-500/20 backdrop-blur-xl">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
            <h2 className="text-3xl font-bold text-white">Time&apos;s Up!</h2>
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
            <p className="rounded-2xl border border-purple-300/20 bg-purple-400/10 p-3 text-sm text-purple-100">
              {agentSignal}
            </p>
            <button
              onClick={handleStart}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
            >
              Play Again
            </button>
            <button
              onClick={handleViewResults}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Save Game Test & View Results
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
        <ambientLight intensity={0.42} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#22d3ee" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#8b5cf6" />
        
        {targets.map(target => (
          <Target3D
            key={target.id}
            position={target.position}
            velocity={target.velocity}
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
