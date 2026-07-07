'use client';

import { useAppStore } from '@/stores/appStore';
import { Brain } from 'lucide-react';

export function TutorView() {
  const { messages, activeTopic } = useAppStore();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <Brain className="h-16 w-16 text-primary animate-float" />
      <h2 className="text-2xl font-bold gradient-text">AI Tutor</h2>
      <p className="text-muted-foreground text-center max-w-md">
        {activeTopic
          ? `Currently discussing: ${activeTopic}`
          : 'Start a session from the Dashboard or a Course to begin learning with your AI tutor.'}
      </p>
      {messages.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? 's' : ''} in this session
        </p>
      )}
    </div>
  );
}