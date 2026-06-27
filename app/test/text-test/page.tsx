"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TextBasedTest from '@/components/test/TextBasedTest';
import CameraMonitor from '@/components/camera/CameraMonitor';
import QuestionGenerationLoader from '@/components/test/QuestionGenerationLoader';
import { useTestStore } from '@/lib/store';

export default function TextTestPage() {
  const router = useRouter();
  const questionsLoading = useTestStore((state) => state.questionsLoading);
  const hasQuestions = useTestStore((state) => state.questions.length > 0);

  // If we land here with no questions and nothing is generating, go back.
  useEffect(() => {
    if (!questionsLoading && !hasQuestions) {
      router.replace('/test');
    }
  }, [questionsLoading, hasQuestions, router]);

  if (questionsLoading || !hasQuestions) {
    return <QuestionGenerationLoader type="text" />;
  }

  return (
    <>
      <CameraMonitor />
      <TextBasedTest />
    </>
  );
}
