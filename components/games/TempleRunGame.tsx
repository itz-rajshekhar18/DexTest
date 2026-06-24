"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box, Sphere } from "@react-three/drei";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { isTestCompleted, useTestStore } from "@/lib/store";
import { gameIQAgent } from "@/lib/aiAgents";
import { ArrowRight, ChevronsLeftRight, Timer, Trophy, Zap } from "lucide-react";

type Lane = -1 | 0 | 1;

function Player({ lane, jumpTick }: { lane: Lane; jumpTick: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const velocityYRef = useRef(0);
  const groundedRef = useRef(true);

  useEffect(() => {
    if (jumpTick > 0 && groundedRef.current) {
      velocityYRef.current = 0.22;
      groundedRef.current = false;
    }
  }, [jumpTick]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.x += (lane * 2.25 - groupRef.current.position.x) * 0.18;
    groupRef.current.position.y += velocityYRef.current;
    velocityYRef.current -= 0.012;

    if (groupRef.current.position.y <= 0) {
      groupRef.current.position.y = 0;
      velocityYRef.current = 0;
      groundedRef.current = true;
    }

    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 7) * 0.08;
  });

  return (
    <group ref={groupRef} position={[0, 0, 2]}>
      <Sphere args={[0.48, 32, 32]}>
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.35} metalness={0.7} roughness={0.18} />
      </Sphere>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.025, 8, 72]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

function Obstacle({
  lane,
  startZ,
  active,
  playerLane,
  jumping,
  onPass,
  onCollision,
}: {
  lane: Lane;
  startZ: number;
  active: boolean;
  playerLane: Lane;
  jumping: boolean;
  onPass: () => void;
  onCollision: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const passedRef = useRef(false);
  const collidedRef = useRef(false);

  useEffect(() => {
    passedRef.current = false;
    collidedRef.current = false;
  }, [active]);

  useFrame(() => {
    if (!meshRef.current || !active) return;

    meshRef.current.position.z += 0.16;
    meshRef.current.rotation.y += 0.018;

    const nearPlayer = Math.abs(meshRef.current.position.z - 2) < 0.74;
    const sameLane = lane === playerLane;

    if (nearPlayer && sameLane && !jumping && !collidedRef.current) {
      collidedRef.current = true;
      onCollision();
      return;
    }

    if (meshRef.current.position.z > 5.5 && !passedRef.current) {
      passedRef.current = true;
      onPass();
    }

    if (meshRef.current.position.z > 8) {
      meshRef.current.position.z = startZ - 18 - Math.random() * 10;
      passedRef.current = false;
      collidedRef.current = false;
    }
  });

  return (
    <Box ref={meshRef} args={[1.05, 1.8, 1.05]} position={[lane * 2.25, -0.05, startZ]}>
      <meshStandardMaterial color="#fb7185" emissive="#be123c" emissiveIntensity={0.3} metalness={0.45} roughness={0.24} />
    </Box>
  );
}

function Track() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, -8]}>
        <planeGeometry args={[8.2, 58]} />
        <meshStandardMaterial color="#0f172a" metalness={0.25} roughness={0.55} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x * 1.12, -0.92, -8]}>
          <planeGeometry args={[0.035, 58]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.34} />
        </mesh>
      ))}
    </group>
  );
}

export default function TempleRunGame() {
  const router = useRouter();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [playerLane, setPlayerLane] = useState<Lane>(0);
  const [jumping, setJumping] = useState(false);
  const [jumpTick, setJumpTick] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [agentSignal, setAgentSignal] = useState("Waiting for spatial tracking data.");
  const scoreRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const promptStartedAtRef = useRef(0);
  const endedRef = useRef(false);

  const { setTestType, updateGameScore } = useTestStore();

  useEffect(() => {
    setTestType("game");
    if (isTestCompleted("game")) {
      router.replace("/test");
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

    updateGameScore("templeRun", score, averageReactionTime);
  }, [gameOver, gameStarted, reactionTimes, score, updateGameScore]);

  const endGame = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setGameOver(true);
    setGameStarted(false);

    const assessment = gameIQAgent.assessTempleRun(scoreRef.current, reactionTimesRef.current);
    setAgentSignal(assessment.cognitiveSignal);
    updateGameScore("templeRun", assessment.score, assessment.avgReactionTime);
  }, [updateGameScore]);

  useEffect(() => {
    if (!gameStarted) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameStarted]);

  useEffect(() => {
    if (!gameStarted || timeLeft > 0) return;

    endGame();
  }, [endGame, gameStarted, timeLeft]);

  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      const now = Date.now();
      setReactionTimes((prev) => [...prev, now - promptStartedAtRef.current]);
      promptStartedAtRef.current = now;

      if (event.key === "ArrowLeft") {
        setPlayerLane((prev) => (Math.max(-1, prev - 1) as Lane));
      }

      if (event.key === "ArrowRight") {
        setPlayerLane((prev) => (Math.min(1, prev + 1) as Lane));
      }

      if (event.key === "ArrowUp") {
        setJumping(true);
        setJumpTick((prev) => prev + 1);
        window.setTimeout(() => setJumping(false), 520);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [gameStarted]);

  const handleStart = () => {
    endedRef.current = false;
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setTimeLeft(45);
    setPlayerLane(0);
    setJumping(false);
    setReactionTimes([]);
    setAgentSignal("Collecting spatial tracking data.");
    promptStartedAtRef.current = Date.now();
  };

  const handleObstaclePass = () => {
    setScore((prev) => prev + 15);
    promptStartedAtRef.current = Date.now();
  };

  const handleViewResults = () => {
    router.push("/test/results");
  };

  const avgReaction =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length)
      : 0;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_50%_12%,rgba(34,211,238,0.22),transparent_30%),linear-gradient(180deg,#020617,#111827_52%,#020617)]">
      <div className="absolute left-4 top-4 z-10 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-cyan-300/30 bg-slate-950/70 px-4 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Trophy className="h-4 w-4 text-yellow-300" />
            Score
          </div>
          <div className="text-2xl font-bold text-white">{score}</div>
        </div>
        <div className="rounded-xl border border-cyan-300/30 bg-slate-950/70 px-4 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Timer className="h-4 w-4 text-rose-300" />
            Time
          </div>
          <div className="text-2xl font-bold text-white">{timeLeft}s</div>
        </div>
        <div className="rounded-xl border border-cyan-300/30 bg-slate-950/70 px-4 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Zap className="h-4 w-4 text-emerald-300" />
            Avg
          </div>
          <div className="text-2xl font-bold text-white">{avgReaction}ms</div>
        </div>
      </div>

      {!gameStarted && !gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-3xl border border-cyan-300/25 bg-slate-950/80 p-8 text-center shadow-2xl shadow-cyan-500/20 backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/25 bg-cyan-400/10">
              <ChevronsLeftRight className="h-11 w-11 text-cyan-100" />
            </div>
            <h2 className="text-3xl font-bold text-white">Neural Run</h2>
            <p className="mt-3 text-zinc-400">
              Move lanes and jump obstacles. The Game IQ Agent measures spatial anticipation and reaction control.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-zinc-300">
              <div className="rounded-xl bg-white/[0.05] px-3 py-2">Left</div>
              <div className="rounded-xl bg-white/[0.05] px-3 py-2">Jump</div>
              <div className="rounded-xl bg-white/[0.05] px-3 py-2">Right</div>
            </div>
            <button
              onClick={handleStart}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-semibold text-white transition hover:opacity-90"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-3xl border border-cyan-300/25 bg-slate-950/85 p-8 text-center shadow-2xl shadow-cyan-500/20 backdrop-blur-xl">
            <Trophy className="mx-auto h-16 w-16 text-yellow-300" />
            <h2 className="mt-4 text-3xl font-bold text-white">Run Complete</h2>
            <div className="mt-5 space-y-2 text-zinc-300">
              <p>
                Final Score: <span className="font-bold text-white">{score}</span>
              </p>
              <p>
                Avg Reaction: <span className="font-bold text-white">{avgReaction}ms</span>
              </p>
            </div>
            <p className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
              {agentSignal}
            </p>
            <div className="mt-6 grid gap-3">
              <button
                onClick={handleStart}
                className="w-full rounded-xl bg-slate-800 py-3 font-semibold text-white transition hover:bg-slate-700"
              >
                Play Again
              </button>
              <button
                onClick={handleViewResults}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-semibold text-white transition hover:opacity-90"
              >
                Save Game Test & View Results
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 5.4, 10], fov: 60 }}>
        <fog attach="fog" args={["#020617", 10, 34]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 6]} intensity={1.15} color="#e0f2fe" />
        <pointLight position={[0, 4, 1]} intensity={1.5} color="#22d3ee" />

        <Track />
        <Player lane={playerLane} jumpTick={jumpTick} />
        <Obstacle lane={-1} startZ={-10} active={gameStarted} playerLane={playerLane} jumping={jumping} onPass={handleObstaclePass} onCollision={endGame} />
        <Obstacle lane={0} startZ={-18} active={gameStarted} playerLane={playerLane} jumping={jumping} onPass={handleObstaclePass} onCollision={endGame} />
        <Obstacle lane={1} startZ={-26} active={gameStarted} playerLane={playerLane} jumping={jumping} onPass={handleObstaclePass} onCollision={endGame} />
      </Canvas>

      {gameStarted && (
        <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-2xl border border-cyan-300/25 bg-slate-950/70 px-5 py-3 text-sm font-medium text-cyan-100 backdrop-blur-xl">
          Arrow keys: move left, jump, move right.
        </div>
      )}
    </div>
  );
}
