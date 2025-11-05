'use client';

import { useEffect, useState } from 'react';

export function UnlockAnimation({ children }: { children: React.ReactNode }) {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`transition-all duration-1000 ${
        isAnimating
          ? 'opacity-0 translate-y-4'
          : 'opacity-100 translate-y-0'
      }`}
    >
      {children}
    </div>
  );
}

