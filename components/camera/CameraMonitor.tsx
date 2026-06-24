"use client";

import React, { useRef, useCallback, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, CameraOff, Eye } from 'lucide-react';
import { useTestStore } from '@/lib/store';

export default function CameraMonitor() {
  const webcamRef = useRef<Webcam>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const { setCameraEnabled, updateAttentionScore } = useTestStore();

  const startCamera = useCallback(() => {
    setIsEnabled(true);
    setCameraEnabled(true);
  }, [setCameraEnabled]);

  const stopCamera = useCallback(() => {
    setIsEnabled(false);
    setCameraEnabled(false);
  }, [setCameraEnabled]);

  // Simulate attention monitoring (in production, use face detection ML models)
  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(() => {
      // Simulate attention score (in real app, analyze face position, eye movement)
      const randomScore = Math.floor(Math.random() * 20) + 80; // 80-100
      updateAttentionScore(randomScore);
    }, 2000);

    return () => clearInterval(interval);
  }, [isEnabled, updateAttentionScore]);

  return (
    <div
      data-ai-effects="off"
      className="z-50 flex w-fit max-w-max flex-col items-end gap-2"
      style={{ position: "fixed", top: 16, right: 16 }}
    >
      {isEnabled ? (
        <>
          <div className="relative h-28 w-40 overflow-hidden rounded-xl border border-indigo-400/50 shadow-2xl shadow-indigo-950/40">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              className="h-full w-full object-cover"
              mirrored={true}
            />
            <div className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-red-500" />
          </div>
          <button
            onClick={stopCamera}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-red-950/30 transition-colors hover:bg-red-500"
          >
            <CameraOff className="h-3.5 w-3.5" />
            Stop Monitoring
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs text-zinc-200 backdrop-blur-sm">
            <Eye className="h-3 w-3" />
            <span>Tracking active</span>
          </div>
        </>
      ) : (
        <button
          onClick={startCamera}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition-colors hover:bg-indigo-500"
        >
          <Camera className="h-4 w-4" />
          Enable Camera
        </button>
      )}
    </div>
  );
}
