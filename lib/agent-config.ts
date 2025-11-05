// Configuration for Cloudflare Agents integration

export const AGENT_CONFIG = {
  // Feature flag to enable/disable Cloudflare Agents
  // Set to false to use mock AI (current implementation)
  enabled: process.env.NEXT_PUBLIC_USE_CLOUDFLARE_AGENTS === 'true',
  
  // Cloudflare Workers host
  host: process.env.NEXT_PUBLIC_CLOUDFLARE_AGENTS_HOST || '',
  
  // Agent name (matches the class name in workers - kebab-case)
  agentName: 'creator-agent',
  
  // Full URL for agent connections
  get agentUrl() {
    if (typeof window !== 'undefined') {
      // In browser, use the host
      return `https://${this.host}`;
    }
    return '';
  },
} as const;

export function isAgentEnabled(): boolean {
  return AGENT_CONFIG.enabled && !!AGENT_CONFIG.host;
}

