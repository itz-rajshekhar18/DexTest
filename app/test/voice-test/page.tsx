"use client";

import VoiceBasedTest from '@/components/test/VoiceBasedTest';
import CameraMonitor from '@/components/camera/CameraMonitor';

export default function VoiceTestPage() {
  return (
    <>
      <CameraMonitor />
      <VoiceBasedTest />
    </>
  );
}
