'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BlobAvatarProps {
  creatorId?: string;
  creatorName?: string;
  className?: string;
  size?: number;
  onClick?: () => void;
}

export function BlobAvatar({ className, size = 112, onClick }: BlobAvatarProps) {
  return (
    <div 
      className={cn('relative flex items-center justify-center', onClick && 'cursor-pointer hover:opacity-80 transition-opacity', className)} 
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <Image
        src="/images/avatars/blob_avatar.png"
        alt="Blobby"
        width={size}
        height={size}
        className="rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

