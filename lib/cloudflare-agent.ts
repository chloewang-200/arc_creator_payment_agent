// Client-side utilities for connecting to Cloudflare Agents
// This will replace the mock AI when Cloudflare Agents is set up

import { AgentClient } from 'agents/client';

export function createCreatorAgentClient(creatorId: string) {
  return new AgentClient({
    agent: 'creator-agent',
    name: creatorId, // Each creator gets their own agent instance
    host: process.env.NEXT_PUBLIC_CLOUDFLARE_AGENTS_HOST || window.location.host,
  });
}

// Helper to send payment intent from agent to frontend
export function handleAgentPaymentIntent(paymentIntent: any) {
  const event = new CustomEvent('agentPaymentIntent', {
    detail: paymentIntent,
  });
  window.dispatchEvent(event);
}

