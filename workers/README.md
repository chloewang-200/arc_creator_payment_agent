# Cloudflare Agents Setup

## Quick Start

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 3. Install Dependencies
```bash
cd workers
npm install
```

### 4. Configure AI Binding

You need to add AI model binding in Cloudflare Dashboard:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Create a new Worker
3. Go to Settings → Bindings
4. Add AI binding:
   - Binding name: `AI`
   - Select model: OpenAI GPT-4o-mini (or GPT-4o)
   - Add your OpenAI API key

Or add to `wrangler.toml`:
```toml
[[ai.bindings]]
binding = "AI"
model = "@cf/openai/gpt-4o-mini"
```

### 5. Deploy
```bash
npm run deploy
```

### 6. Update Frontend

Install client packages:
```bash
cd .. # back to root
npm install agents @ai-sdk/openai
```

## Benefits Over Current Mock AI

✅ **Real AI conversations** - Understands context, remembers history  
✅ **Natural language** - No regex patterns needed  
✅ **Persistent state** - Chat history survives refreshes  
✅ **Tool calling** - Can directly call payment functions  
✅ **Scalable** - Handles millions of concurrent conversations  
✅ **Production-ready** - Built for enterprise use  

## Cost Estimate

- **Cloudflare Workers**: Free tier = 100K requests/day
- **Durable Objects**: $0.15/million requests  
- **OpenAI GPT-4o-mini**: ~$0.15/1M input tokens, $0.60/1M output tokens
- **Estimated**: $10-50/month for moderate usage

## Migration Strategy

1. Keep current mock AI as fallback
2. Add feature flag to enable Cloudflare Agents
3. Test with real users
4. Gradually migrate

