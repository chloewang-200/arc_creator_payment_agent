'use client';

import { useAccount, useChainId, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, CheckCircle2, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const metamaskConnector = connectors.find(c => c.id === 'metaMask' || c.name === 'MetaMask');

  if (!isConnected) {
    return (
      <Button
        onClick={() => {
          if (metamaskConnector) {
            connect({ connector: metamaskConnector });
          } else {
            // Fallback: try to connect to first available connector
            if (connectors.length > 0) {
              connect({ connector: connectors[0] });
            }
          }
        }}
        disabled={isPending}
        className="gap-2"
      >
        <Wallet className="w-4 h-4" />
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="font-mono text-sm">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="text-xs text-muted-foreground mb-1">Address</div>
          <div className="font-mono text-xs break-all">{address}</div>
        </div>
        <div className="px-2 py-1.5">
          <div className="text-xs text-muted-foreground mb-1">Chain</div>
          <div className="text-xs">Chain ID: {chainId}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()} className="text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

