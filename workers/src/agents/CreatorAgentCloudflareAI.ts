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
    refundConversationThreshold?: number;
    refundAutoThresholdUSD?: number;
    refundContactEmail?: string;
  };
  posts?: Array<{
    id: string;
    title: string;
    priceUSD: number;
    contentType: string;
  }>;
  conversationHistory: any[];
  // Track refund intent attempts per user wallet
  refundIntentAttempts: Record<string, number>; // userWallet -> attempt count
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
    refundIntentAttempts: {},
  };

  async onStart() {
    if (this.state.creatorId) {
      await this.loadCreatorData();
    }
  }

  async onChatMessage(onFinish) {
    // Use Cloudflare Workers AI instead of OpenAI
    // Get the last user message
    const lastUserMessage = this.messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      return new Response("No user message found", { status: 400 });
    }

    // Get user wallet from request context (passed from frontend)
    // Note: This would need to be passed through the request, but for now we'll extract from message metadata
    // In a real implementation, you'd get this from the request body
    const userWallet = (lastUserMessage as any).userWalletAddress;
    
    // Detect refund intent in user message
    const refundKeywords = ['refund', 'return', 'money back', 'get my money back', 'want my money back'];
    const messageLower = lastUserMessage.content.toLowerCase();
    const hasRefundIntent = refundKeywords.some(keyword => messageLower.includes(keyword));
    
    // Initialize refund intent attempts if needed
    if (!this.state.refundIntentAttempts) {
      this.state.refundIntentAttempts = {};
    }
    
    // Track refund intent attempts
    if (hasRefundIntent && userWallet) {
      const currentAttempts = this.state.refundIntentAttempts[userWallet.toLowerCase()] || 0;
      this.state.refundIntentAttempts[userWallet.toLowerCase()] = currentAttempts + 1;
      await this.saveState();
    }
    
    // Build system prompt with current refund attempt count
    const systemPrompt = await this.buildSystemPrompt(userWallet);

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

  async buildSystemPrompt(userWallet?: string): Promise<string> {
    const creator = this.state;
    const aiName = creator.creatorName.split(' ')[0] + 'AI';
    
    let prompt = `You are ${aiName}, ${creator.creatorName}'s AI agent, Bloby. `;
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
    
    // Add refund handling instructions
    const refundThreshold = (creator.pricing as any)?.refundConversationThreshold || 3;
    const refundAutoThreshold = (creator.pricing as any)?.refundAutoThresholdUSD || 1.00;
    const refundEmail = (creator.pricing as any)?.refundContactEmail;
    
    // Get current refund attempt count for this user
    const currentAttempts = userWallet ? (this.state.refundIntentAttempts?.[userWallet.toLowerCase()] || 0) : 0;
    
    prompt += `\nRefund Policy:\n`;
    prompt += `IMPORTANT: Only purchases (unlocks and subscriptions) can be refunded. Tips CANNOT be refunded.\n`;
    prompt += `If user requests refund for a tip, politely explain: "I'm sorry, but tips are non-refundable as they are voluntary contributions to support the creator. However, I can help you with refunds for purchased content (unlocks or subscriptions) if you're not satisfied."\n`;
    prompt += `When a user requests a refund for a purchase (unlock or subscription), try to prevent it (be helpful, offer alternatives, ask what went wrong).\n`;
    prompt += `You have ${refundThreshold} attempts to try to prevent the refund.\n`;
    prompt += `Current refund attempt count for this user: ${currentAttempts} out of ${refundThreshold}\n`;
    
    if (currentAttempts < refundThreshold) {
      prompt += `Since this is attempt ${currentAttempts + 1} (below threshold of ${refundThreshold}), try to prevent the refund:\n`;
      prompt += `- Ask what went wrong\n`;
      prompt += `- Offer to help fix the issue\n`;
      prompt += `- Be empathetic and understanding\n`;
      prompt += `- Suggest alternatives if possible\n`;
      prompt += `Example prevention responses:\n`;
      prompt += `- "I'm sorry to hear you're not satisfied. What went wrong? Maybe I can help fix the issue instead of refunding."\n`;
      prompt += `- "Before we process a refund, could you tell me what didn't meet your expectations? We'd love to make it right."\n`;
      prompt += `- "I understand your concern. Is there something specific we could improve? We value your feedback."\n`;
    } else {
      prompt += `Since this is attempt ${currentAttempts} (at or above threshold of ${refundThreshold}), process the refund:\n`;
      prompt += `- Acknowledge their request\n`;
      prompt += `- Ask for transaction details (transactionId, refundType must be "unlock" or "subscription", amountUSD, chainId)\n`;
      prompt += `- IMPORTANT: refundType must be "unlock" or "subscription", NOT "tip" or "recurringTip"\n`;
      prompt += `- If amount is under $${refundAutoThreshold}, send: {"type": "refund_request", "transactionId": "...", "refundType": "unlock|subscription", "amountUSD": X, "chainId": Y}\n`;
      if (refundEmail) {
        prompt += `- If amount is above $${refundAutoThreshold}, direct them to contact ${refundEmail}\n`;
      } else {
        prompt += `- If amount is above $${refundAutoThreshold}, explain that refunds above this amount require contacting the creator directly\n`;
      }
    }
    
    prompt += `- Refunds include a 2% processing fee\n`;
    prompt += `- If a user asks about their refund status, you can mention that refunds require creator approval and may take some time\n`;
    prompt += `- If a refund was rejected, you can say: "It seems like your refund request was rejected. You can contact the creator directly if you have questions about this decision."\n`;

    return prompt;
  }

  async loadCreatorData() {
    // In production, fetch from your database/API
  }
}

