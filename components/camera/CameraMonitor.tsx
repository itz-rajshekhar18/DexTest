"use client";

import React, { useRef, useCallback, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, CameraOff, Eye } from 'lucide-react';
import { useTestStore } from '@/lib/store';

export default function CameraMonitor() {
  const webcamRef = useRef<Webcam>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const { cameraEnabled, setCameraEnabled, updateAttentionScore } = useTestStore();

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
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-2xl p-3 shadow-2xl">
        {isEnabled ? (
          <div className="space-y-2">
            <div className="relative w-40 h-30 rounded-xl overflow-hidden border-2 border-indigo-500/50">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                mirrored={true}
              />
              <div className="absolute top-1 right-1 bg-red-500 rounded-full w-2 h-2 animate-pulse" />
            </div>
            
            <button
              onClick={stopCamera}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
            >
              <CameraOff className="w-3 h-3" />
              Stop Monitoring
            </button>
            
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Eye className="w-3 h-3" />
              <span>Attention tracking active</span>
            </div>
          </div>
        ) : (
          <button
            onClick={startCamera}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm font-medium transition-colors"
          >
            <Camera className="w-4 h-4" />
            Enable Camera
          </button>
        )}
      </div>
    </div>
  );
}
