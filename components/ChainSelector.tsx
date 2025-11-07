'use client';

import { useState, useEffect } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { supportedChains } from '@/lib/wagmi-config';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Network } from 'lucide-react';

export function ChainSelector() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentChain = supportedChains.find((c) => c.id === chainId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Network className="w-4 h-4" />
          <span className="hidden sm:inline">
            {mounted ? (currentChain?.name || 'Select Chain') : 'Select Chain'}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Select Network</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {supportedChains.map((chain) => {
          const isSelected = chain.id === chainId;

          return (
            <DropdownMenuItem
              key={chain.id}
              onClick={() => {
                if (!isSelected && switchChain) {
                  switchChain({ chainId: chain.id });
                }
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isSelected && <Check className="w-4 h-4" />}
                <span>{chain.name}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

