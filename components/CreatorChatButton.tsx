'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface CreatorChatButtonProps {
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
}

export function CreatorChatButton({ creatorId, creatorName, creatorUsername }: CreatorChatButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const router = useRouter();
  const firstName = creatorName.split(' ')[0];

  const handleClick = () => {
    router.push(`/creator/${creatorUsername}?chat=true`);
  };

  return (
    <div
      className="relative"
    //   onMouseEnter={() => setShowTooltip(true)}
    //   onMouseLeave={() => setShowTooltip(false)}
    >
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-foreground text-background rounded-lg shadow-lg text-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 z-[60]">
          Chat with {firstName}'s bloby
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
        </div>
      )}
      <Button
        // disabled
        className="h-10 w-10 rounded-full  bg-white border border-border pointer-events-none"
        size="icon"
      >
        <span className="text-lg">👋</span>
      </Button>
    </div>
  );
}

