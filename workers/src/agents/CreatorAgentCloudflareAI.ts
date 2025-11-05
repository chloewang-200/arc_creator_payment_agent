import { AIChatAgent } from "agents/ai-chat-agent";

// Alternative version using Cloudflare's Workers AI instead of OpenAI
// This version uses the built-in Cloudflare AI models (free!)

interface CreatorAgentState {
  creatorId: string;
  creatorName: string;
  creatorBio?: string;
  walletAddress?: string;
  pricing?: {
    monthlyUSD: number;
    tipPresetsUSD: number[];
    recurringTipUSD?: number;
  };
  posts?: Array<{
    id: string;
    title: string;
    priceUSD: number;
    contentType: string;
  }>;
  conversationHistory: any[];
}

interface Env {
  AI: {
    run: (model: string, options: any) => Promise<any>;
  };
  CREATOR_AGENT: DurableObjectNamespace;
}

export class CreatorAgent extends AIChatAgent<Env, CreatorAgentState> {
  initialState: CreatorAgentState = {
    creatorId: "",
    creatorName: "",
    conversationHistory: [],
  };

  async onStart() {
    if (this.state.creatorId) {
      await this.loadCreatorData();
    }
  }

  async onChatMessage(onFinish) {
    // Use Cloudflare Workers AI instead of OpenAI
    const systemPrompt = await this.buildSystemPrompt();
    
    // Get the last user message
    const lastUserMessage = this.messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      return new Response("No user message found", { status: 400 });
    }

    // Use Cloudflare's Llama model (free!)
    const prompt = `${systemPrompt}\n\nUser: ${lastUserMessage.content}\n\nAssistant:`;

    try {
      const response = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          ...this.messages.slice(-10), // Last 10 messages for context
        ],
        max_tokens: 512,
      });

      // Save messages
      await this.saveMessages(this.messages);

      // Return streaming response (simulate streaming for Cloudflare AI)
      const stream = new ReadableStream({
        async start(controller) {
          const text = response.response || response.text || JSON.stringify(response);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: text })}\n\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { 
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (error: any) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }

  async buildSystemPrompt(): Promise<string> {
    const creator = this.state;
    const aiName = creator.creatorName.split(' ')[0] + 'AI';
    
    let prompt = `You are ${aiName}, ${creator.creatorName}'s AI avatar. `;
    prompt += `You represent ${creator.creatorName} and help their audience discover content, answer questions, and make payments.\n\n`;
    
    if (creator.creatorBio) {
      prompt += `About ${creator.creatorName}: ${creator.creatorBio}\n\n`;
    }

    if (creator.pricing) {
      prompt += `Pricing:\n`;
      if (creator.pricing.monthlyUSD > 0) {
        prompt += `- Monthly subscription: $${creator.pricing.monthlyUSD}/month\n`;
      }
      if (creator.pricing.tipPresetsUSD.length > 0) {
        prompt += `- Tip presets: $${creator.pricing.tipPresetsUSD.join(', $')}\n`;
      }
      if (creator.pricing.recurringTipUSD) {
        prompt += `- Recurring tip option: $${creator.pricing.recurringTipUSD}/month\n`;
      }
      prompt += `\n`;
    }

    if (creator.posts && creator.posts.length > 0) {
      prompt += `Available Content:\n`;
      creator.posts.forEach((post, i) => {
        prompt += `${i + 1}. "${post.title}" (${post.contentType}) - $${post.priceUSD.toFixed(2)}\n`;
      });
      prompt += `\n`;
    }

    prompt += `Important guidelines:\n`;
    prompt += `- Be friendly, helpful, and conversational\n`;
    prompt += `- When users want to pay, unlock content, or tip, mention that they can use the payment buttons\n`;
    prompt += `- Always remind users they need to confirm transactions in their wallet\n`;
    prompt += `- Answer questions about ${creator.creatorName}'s content and work\n`;
    prompt += `- Keep responses concise and helpful\n`;
    prompt += `- If user asks about unrelated topics (not about payments, subscriptions, tips, or ${creator.creatorName}'s content), politely redirect:\n`;
    prompt += `  Say: "I can only help you with payments and support for ${creator.creatorName}. Anything else I can help with?"\n`;
    prompt += `  Or: "Sorry, I'm here to help with payments and support for ${creator.creatorName}. What would you like to know about my content?"\n`;

    return prompt;
  }

  async loadCreatorData() {
    // In production, fetch from your database/API
  }
}

