import { CreatorAgent } from "./agents/CreatorAgent";

// Export the Durable Object class
export { CreatorAgent };

// Default export for Cloudflare Worker
// CORS headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // In production, replace with your frontend domain
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight FIRST, before any routing
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Handle HTTP requests to the worker
    const url = new URL(request.url);
    
    // Route to agent instances
    if (url.pathname.startsWith("/agent/")) {
      try {
        const agentId = url.pathname.split("/agent/")[1];
        const id = env.CREATOR_AGENT.idFromName(agentId);
        const stub = env.CREATOR_AGENT.get(id);
        const response = await stub.fetch(request);
        
        // Add CORS headers to agent responses (always, even if already present)
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      } catch (error: any) {
        // Ensure CORS headers are present even on errors
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }
    
    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "arc-creator-agents" }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
    
    return new Response("Arc Creator Agents API", { 
      status: 200,
      headers: corsHeaders,
    });
  },
};

interface Env {
  CREATOR_AGENT: DurableObjectNamespace;
  AI: {
    openai?: any;
  };
}

