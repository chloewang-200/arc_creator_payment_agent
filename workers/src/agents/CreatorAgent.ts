// Standalone Durable Object for Creator Agents (no SDK dependencies)

interface Env {
  AI: {
    run: (model: string, options: any) => Promise<any>;
  };
  CREATOR_AGENT: DurableObjectNamespace;
}

export class CreatorAgent {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'POST') {
      try {
        const data = await request.json() as any;

              if (data.type === 'init') {
                // Log what we received
                console.log('🔵 INIT received:', {
                  creatorName: data.creatorName,
                  postsCount: data.posts?.length || 0,
                  hasContent: data.hasContent,
                  posts: data.posts,
                });

                // Only store defined values
                if (data.creatorId !== undefined) await this.state.storage.put('creatorId', data.creatorId);
                if (data.creatorName !== undefined) await this.state.storage.put('creatorName', data.creatorName);
                if (data.creatorBio !== undefined) await this.state.storage.put('creatorBio', data.creatorBio);
                if (data.walletAddress !== undefined) await this.state.storage.put('walletAddress', data.walletAddress);
                if (data.pricing !== undefined) await this.state.storage.put('pricing', data.pricing);
                if (data.posts !== undefined) await this.state.storage.put('posts', data.posts);
                if (data.hasContent !== undefined) await this.state.storage.put('hasContent', data.hasContent);
                if (data.aiTone !== undefined) await this.state.storage.put('aiTone', data.aiTone);
                if (data.aiBackground !== undefined) await this.state.storage.put('aiBackground', data.aiBackground);
                if (data.aiPersonality !== undefined) await this.state.storage.put('aiPersonality', data.aiPersonality);

                // Verify what was stored
                const storedPosts = await this.state.storage.get('posts');
                const storedHasContent = await this.state.storage.get('hasContent');
                console.log('✅ STORED:', {
                  postsCount: Array.isArray(storedPosts) ? storedPosts.length : 0,
                  hasContent: storedHasContent,
                  posts: storedPosts,
                });

          return new Response(JSON.stringify({
            type: 'initialized',
            message: 'Agent initialized for ' + (data.creatorName || 'creator'),
            debug: {
              postsStored: Array.isArray(storedPosts) ? storedPosts.length : 0,
              hasContent: storedHasContent,
            },
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (data.type === 'chat' || data.message) {
          const conversationHistory = (await this.state.storage.get('conversationHistory') as any[]) || [];
          const userMessage = data.message || data.text;
          const userWallet = data.userWalletAddress; // Get user wallet from request
          const userPurchases = data.userPurchases || []; // Get purchases from frontend

          conversationHistory.push({ role: 'user', content: userMessage });

          // Track refund intent attempts
          if (userWallet) {
            const refundIntentAttempts = (await this.state.storage.get('refundIntentAttempts') as Record<string, number>) || {};
            const refundKeywords = ['refund', 'return', 'money back', 'get my money back', 'want my money back'];
            const messageLower = userMessage.toLowerCase();
            const hasRefundIntent = refundKeywords.some(keyword => messageLower.includes(keyword));

            if (hasRefundIntent) {
              const walletKey = userWallet.toLowerCase();
              const currentAttempts = refundIntentAttempts[walletKey] || 0;
              refundIntentAttempts[walletKey] = currentAttempts + 1;
              await this.state.storage.put('refundIntentAttempts', refundIntentAttempts);
            }
          }

          const response = await this.handleChat(conversationHistory, data.userWalletAddress, userPurchases);
          await this.state.storage.put('conversationHistory', conversationHistory);

          const newHeaders = new Headers(response.headers);
          Object.entries(corsHeaders).forEach(([key, value]) => newHeaders.set(key, value));

          return new Response(response.body, {
            status: response.status,
            headers: newHeaders,
          });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  async handleChat(conversationHistory: any[], userWallet?: string, userPurchases?: any[]): Promise<Response> {
    if (!this.env.AI) {
      return new Response("AI not configured", { status: 500 });
    }

    const systemPrompt = await this.buildSystemPrompt(userWallet, userPurchases);

    try {
      const response = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-10),
        ],
        max_tokens: 512,
      });

      const responseText = response.response || response.text || JSON.stringify(response);
      conversationHistory.push({ role: 'assistant', content: responseText });

      // Check if response contains a payment action or refund request
      let paymentAction = null;
      let refundRequest = null;

      try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[^}]*"action"[^}]*\}/);
        if (jsonMatch) {
          paymentAction = JSON.parse(jsonMatch[0]);
          console.log('💰 Payment action detected:', paymentAction);
        }

        // Check for refund_request trigger (when AI says user wants refund)
        const refundMatch = responseText.match(/\{[^}]*"type":\s*"refund_request"[^}]*\}/);
        if (refundMatch) {
          refundRequest = JSON.parse(refundMatch[0]);
          console.log('💸 Refund request detected:', refundRequest);
        }
      } catch (e) {
        // Not JSON, that's fine
      }

      const stream = new ReadableStream({
        start(controller) {
          // If we found a payment action, emit it first
          if (paymentAction) {
            controller.enqueue(new TextEncoder().encode(
              'data: ' + JSON.stringify({
                type: 'payment_action',
                action: paymentAction.action,
                params: {
                  postId: paymentAction.postId,
                  amount: paymentAction.amount,
                }
              }) + '\n\n'
            ));

            // Send a friendly message after the action
            const friendlyMessage = paymentAction.action === 'unlock'
              ? 'Great! Opening checkout for you...'
              : paymentAction.action === 'subscribe'
              ? 'Perfect! Setting up your subscription...'
              : 'Awesome! Processing your tip...';

            controller.enqueue(new TextEncoder().encode(
              'data: ' + JSON.stringify({ type: 'message', content: friendlyMessage }) + '\n\n'
            ));
          } else if (refundRequest) {
            // Emit the refund request
            controller.enqueue(new TextEncoder().encode(
              'data: ' + JSON.stringify(refundRequest) + '\n\n'
            ));

            // Send a friendly message
            controller.enqueue(new TextEncoder().encode(
              'data: ' + JSON.stringify({ type: 'message', content: 'Processing your refund request...' }) + '\n\n'
            ));
          } else {
            // Regular message
            controller.enqueue(new TextEncoder().encode(
              'data: ' + JSON.stringify({ type: 'message', content: responseText }) + '\n\n'
            ));
          }
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error: any) {
      return new Response('Error: ' + error.message, { status: 500 });
    }
  }

  async buildSystemPrompt(userWallet?: string, userPurchases?: any[]): Promise<string> {
    const creatorName = await this.state.storage.get('creatorName') as string || 'Creator';
    const creatorBio = await this.state.storage.get('creatorBio') as string;
    const aiTone = await this.state.storage.get('aiTone') as string;
    const aiPersonality = await this.state.storage.get('aiPersonality') as string;
    const aiBackground = await this.state.storage.get('aiBackground') as string;
    const pricing = await this.state.storage.get('pricing') as any;
    const posts = await this.state.storage.get('posts') as any[];
    const hasContent = await this.state.storage.get('hasContent') as boolean;

    // Get refund intent attempts for this user
    const refundIntentAttempts = (await this.state.storage.get('refundIntentAttempts') as Record<string, number>) || {};
    const currentAttempts = userWallet ? (refundIntentAttempts[userWallet.toLowerCase()] || 0) : 0;
    const refundThreshold = pricing?.refundConversationThreshold || 3;
    const refundAutoThreshold = pricing?.refundAutoThresholdUSD || 1.00;
    const refundEmail = pricing?.refundContactEmail;

    // Use purchases provided by frontend (already fetched from /api/purchases)
    const purchases = userPurchases || [];
    console.log('📦 Using user purchases:', purchases);

    // Log what we loaded for the system prompt
    console.log('🟢 Building system prompt with:', {
      creatorName,
      postsCount: Array.isArray(posts) ? posts.length : 0,
      hasContent,
      posts: posts,
      pricing: pricing,
    });

    // Universal context for ALL creator avatars
    let prompt = 'You are ' + creatorName + "'s AI assistant. Speak casually in first person as their helper.\n\n";

    // Determine if this is a tips-only creator (no posts or hasContent explicitly false)
    const isTipsOnly = hasContent === false || (!hasContent && (!posts || posts.length === 0));
    
    if (!isTipsOnly) {
      prompt += 'YOUR ONLY JOB: Help people unlock content, subscribe, tip, or ask about posts. Nothing else.\n\n';
    } else {
      prompt += 'YOUR ONLY JOB: Help people tip or set up recurring monthly support. I do NOT have any content, posts, or products to sell.\n';
      prompt += 'IMPORTANT: DO NOT mention any content, posts, or products. DO NOT make up prices or content that doesn\'t exist.\n';
      prompt += 'If someone asks about products/content, say: "I don\'t have any content to purchase, but you can support me with tips!"\n\n';
    }

    prompt += 'CONVERSATION RULES:\n';
    prompt += '1. Keep EVERY response friendly and under 20 words\n';
    prompt += '2. Be casual and direct (like texting a friend)\n';
    prompt += '3. Use REAL numbers from the data below, never use placeholders like $X or $Y\n';
    prompt += '4. When user confirms they want to pay (says "yes", "ok", "sure", etc.), output ONLY this JSON:\n';
    prompt += '   {"action": "unlock", "postId": "POST_ID_HERE", "amount": PRICE_NUMBER}\n';
    prompt += '   OR for subscription: {"action": "subscribe", "amount": PRICE_NUMBER}\n';
    prompt += '   OR for tip: {"action": "tip", "amount": PRICE_NUMBER}\n';
    prompt += '5. IMPORTANT: When user says yes/ok to a purchase, ONLY output the JSON action, nothing else\n';
    prompt += '6. If user asks about unrelated topics, politely redirect:\n';
    prompt += '   Say: "I can only help you with payments and support for ' + creatorName + '. Anything else I can help with?"\n\n';

    // Creator-specific context
    prompt += '=== MY IDENTITY ===\n';
    prompt += 'I am ' + creatorName + '.\n';
    if (creatorBio) prompt += 'About me: ' + creatorBio + '\n';
    if (aiTone) prompt += 'My tone: ' + aiTone + '\n';
    if (aiPersonality) prompt += 'My personality: ' + aiPersonality + '\n';
    if (aiBackground) prompt += 'Additional context: ' + aiBackground + '\n';
    prompt += '\n';

    // Pricing info
    if (pricing) {
      prompt += '=== PRICING ===\n';
      if (pricing.monthlyUSD > 0) {
        prompt += '- Monthly subscription: $' + pricing.monthlyUSD + '/month (access to ALL content, cancel anytime)\n';
      }
      if (pricing.tipPresetsUSD && pricing.tipPresetsUSD.length > 0) {
        prompt += '- Tips: $' + pricing.tipPresetsUSD.join(', $') + '\n';
      }
      prompt += '\n';
    }

    // Available content with individual prices
    if (!isTipsOnly && posts && posts.length > 0) {
      prompt += '=== MY CONTENT (WITH INDIVIDUAL PRICES) ===\n';
      posts.forEach((post: any, i: number) => {
        prompt += (i + 1) + '. "' + post.title + '" (' + post.contentType + ') - $' + post.priceUSD.toFixed(2) + '\n';
      });
      prompt += '\n';
      prompt += 'IMPORTANT: Each post has its own price listed above. Use the EXACT price for each specific post when talking about it.\n';
      prompt += 'If a post costs $0.69, say $0.69. If another costs $2.99, say $2.99. NEVER use a generic price.\n\n';
    } else {
      // IMPORTANT: If no posts, explicitly state this is a tips-only creator
      prompt += '=== MY CONTENT ===\n';
      prompt += 'I do NOT have any content, posts, or products to purchase.\n';
      prompt += 'I am a TIPS-ONLY creator. People can only support me with tips or recurring monthly support.\n';
      prompt += 'DO NOT mention any content, posts, or products. DO NOT make up prices or content.\n';
      prompt += 'If asked about products/content, say: "I don\'t have any content to purchase, but you can support me with tips!"\n\n';
    }

    // Examples with REAL numbers (show the AI how to do it right)
    prompt += '=== EXAMPLE RESPONSES ===\n';
    if (!isTipsOnly && pricing && pricing.monthlyUSD && posts && posts.length > 0) {
      const firstPost = posts[0];
      const secondPost = posts.length > 1 ? posts[1] : null;
      const examplePostPrice = firstPost.priceUSD.toFixed(2);
      const exampleMonthly = pricing.monthlyUSD.toFixed(0);

      prompt += 'User says "hi" → You say: "hey! posts are $' + examplePostPrice + ' each, or $' + exampleMonthly + '/mo for all. interested?"\n';
      prompt += 'User asks about "' + firstPost.title + '" → You say: "it\'s about [topic]. $' + examplePostPrice + ' to unlock or get monthly?"\n';
      if (secondPost) {
        prompt += 'User asks about "' + secondPost.title + '" → You say: "it\'s about [topic]. $' + secondPost.priceUSD.toFixed(2) + ' to unlock or get monthly?"\n';
      }
      prompt += 'User wants to unlock a post → You say: "unlocking for $' + examplePostPrice + '. proceed?" (use the ACTUAL price of that specific post)\n';
      prompt += '\nREMEMBER: If posts have different prices, use the SPECIFIC price for each post. Don\'t use one price for all posts!\n';
    } else {
      // Tips-only creator examples
      const tipAmounts = pricing?.tipPresetsUSD && pricing.tipPresetsUSD.length > 0 
        ? pricing.tipPresetsUSD.join(', $') 
        : '5, 10';
      const recurringTip = pricing?.recurringTipUSD || 10;
      
      prompt += 'User says "hi" → You say: "hey! thanks for stopping by. you can tip me $' + tipAmounts + ' or $' + recurringTip + '/mo for recurring support!"\n';
      prompt += 'User asks "do you have products?" → You say: "I don\'t have any content to purchase, but you can support me with tips! $' + tipAmounts + ' or $' + recurringTip + '/mo recurring support."\n';
      prompt += 'User asks about content → You say: "I\'m a tips-only creator, so no content to unlock. But tips help me keep going! $' + tipAmounts + ' or $' + recurringTip + '/mo?"\n';
    }
    prompt += '\nNOTICE: These examples use REAL DOLLAR AMOUNTS from the PRICING section above. NEVER make up prices or content!\n\n';

    prompt += 'FINAL REMINDER:\n';
    prompt += '- Replace prices with actual numbers from the PRICING and CONTENT sections above\n';
    if (!isTipsOnly && posts && posts.length > 0) {
      prompt += '- Each post has its own price - use the EXACT price for each specific post when discussing it\n';
      prompt += '- If posts have different prices, reference the specific price for that post\n';
    }
    prompt += '- Keep responses friendly and under 20 words\n';
    if (!isTipsOnly) {
      prompt += '- Stay focused on helping with payments and content questions only\n';
    } else {
      prompt += '- I have NO content, posts, or products. ONLY mention tips and recurring support\n';
      prompt += '- If asked about products/content, say I don\'t have any, but offer tips instead\n';
      prompt += '- NEVER make up prices or content that doesn\'t exist\n';
    }
    prompt += '- If asked about unrelated topics, politely redirect back to payments/support\n';
    
    // Add refund handling instructions
    prompt += '\n=== REFUND POLICY ===\n';
    prompt += 'IMPORTANT: Only purchases (unlocks and subscriptions) can be refunded. Tips CANNOT be refunded.\n';
    prompt += 'If user requests refund for a tip, politely explain: "I\'m sorry, but tips are non-refundable as they are voluntary contributions to support the creator. However, I can help you with refunds for purchased content (unlocks or subscriptions) if you\'re not satisfied."\n';

    // Show user's purchase history for easy refunds
    if (purchases.length > 0) {
      prompt += '\n=== USER\'S PURCHASES (REFUNDABLE) ===\n';
      purchases.forEach((purchase: any, index: number) => {
        if (purchase.type === 'unlock') {
          prompt += (index + 1) + '. "' + purchase.postTitle + '" - $' + purchase.amountUSD.toFixed(2) + ' (transactionId: ' + purchase.transactionId + ')\n';
        } else if (purchase.type === 'subscription') {
          prompt += (index + 1) + '. Monthly Subscription - $' + purchase.amountUSD.toFixed(2) + ' (transactionId: ' + purchase.transactionId + ')\n';
        }
      });
      prompt += '\n';
    } else {
      prompt += 'This user has NO purchases to refund.\n';
      prompt += 'If they ask for a refund, politely explain: "You haven\'t made any purchases yet, so there\'s nothing to refund."\n';
    }

    prompt += 'When a user requests a refund for a purchase (unlock or subscription), try to prevent it (be helpful, offer alternatives, ask what went wrong).\n';
    prompt += 'You have ' + refundThreshold + ' attempts to try to prevent the refund.\n';
    prompt += 'Current refund attempt count for this user: ' + currentAttempts + ' out of ' + refundThreshold + '\n';

    if (currentAttempts < refundThreshold) {
      prompt += 'Since this is attempt ' + (currentAttempts + 1) + ' (below threshold of ' + refundThreshold + '), try to prevent the refund:\n';
      prompt += '- Ask what went wrong\n';
      prompt += '- Offer to help fix the issue\n';
      prompt += '- Be empathetic and understanding\n';
      prompt += '- Suggest alternatives if possible\n';
      prompt += 'Example prevention responses:\n';
      prompt += '- "I\'m sorry to hear you\'re not satisfied. What went wrong? Maybe I can help fix the issue instead of refunding."\n';
      prompt += '- "Before we process a refund, could you tell me what didn\'t meet your expectations? We\'d love to make it right."\n';
      prompt += '- "I understand your concern. Is there something specific we could improve? We value your feedback."\n';
    } else {
      prompt += 'Since this is attempt ' + currentAttempts + ' (at or above threshold of ' + refundThreshold + '), process the refund:\n';
      prompt += '- Acknowledge their request\n';

      if (purchases.length > 0) {
        prompt += '- Look at the USER\'S PURCHASES section above\n';
        prompt += '- If they have ONE purchase, automatically use it: {"type": "refund_request", "transactionId": "' + purchases[0].transactionId + '", "refundType": "' + purchases[0].type + '", "amountUSD": ' + purchases[0].amountUSD + ', "postId": "' + (purchases[0].postId || '') + '", "chainId": 5042002}\n';

        if (purchases.length > 1) {
          prompt += '- If they have MULTIPLE purchases, ask which one: "Which would you like to refund? ' + purchases.map((p: any, i: number) => (i + 1) + '. ' + (p.postTitle || 'Subscription')).join(', ') + '"\n';
          prompt += '- Once they choose, use the corresponding transactionId from the list above\n';
        }

        // Check amounts for auto-refund eligibility
        const hasSmallPurchase = purchases.some((p: any) => p.amountUSD <= refundAutoThreshold);
        const hasLargePurchase = purchases.some((p: any) => p.amountUSD > refundAutoThreshold);

        if (hasLargePurchase && refundEmail) {
          prompt += '- If the purchase amount is above $' + refundAutoThreshold.toFixed(2) + ', direct them to contact ' + refundEmail + '\n';
        } else if (hasLargePurchase) {
          prompt += '- If the purchase amount is above $' + refundAutoThreshold.toFixed(2) + ', explain that refunds above this amount require contacting the creator directly\n';
        }
      } else {
        prompt += '- Since user has NO purchases, politely explain they have nothing to refund\n';
      }
    }
    prompt += '- Refunds may include a 2% processing fee for manual approvals\n';
    prompt += '- If a user asks about their refund status, you can mention that refunds may require creator approval and can take some time\n';
    prompt += '- If a refund was rejected, you can say: "It seems like your refund request was rejected. You can contact the creator directly if you have questions about this decision."\n';
    
    return prompt;
  }
}
