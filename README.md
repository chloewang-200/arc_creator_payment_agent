# Bloby

https://arc-creator-payment-agent.vercel.app/

**The future of the creator economy.** Bloby is a platform that empowers creators to monetize their content with instant USDC payments, AI-powered assistants, and complete ownership of their audience.

## 🌟 What is Bloby?

Bloby is a creator platform built on Arc Network that enables:
- **Instant USDC Payments** - Get paid the moment fans consume your content
- **AI Assistant (Bloby)** - Every creator gets their own 24/7 AI assistant to handle support and payments
- **Multiple Revenue Streams** - Pay-per-content, subscriptions, tips, and recurring support
- **Complete Ownership** - Your audience, your data, your business
- **Global Reach** - Accept payments from anywhere with feeless transactions

## 🚀 Features

### For Creators
- 🤖 **Personal AI Assistant** - Bloby handles customer support, payment processing, and content discovery
- 💰 **Instant Payments** - Get paid immediately in USDC, no waiting periods
- 📊 **Complete Dashboard** - Track earnings, manage content, and configure AI settings
- 🎤 **AI Voice Cloning** - Generate voice previews for locked content using ElevenLabs
- 🛡️ **Smart Refund Management** - Automated refund processing with Circle Programmable Wallets
- 🌐 **Multi-Chain Support** - Arc Testnet, Ethereum Sepolia, Base Sepolia, Sei Testnet

### For Fans
- 🔓 **Pay-Per-Content** - Unlock individual pieces of content instantly
- 💳 **Flexible Payments** - One-time tips, recurring support, or monthly subscriptions
- 🎧 **Voice Previews** - Hear 10-second AI voice previews before unlocking
- 💬 **AI Chat** - Chat with creators' AI assistants for support and discovery

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Wagmi & Viem** - Web3 wallet integration

### Backend
- **Supabase** - PostgreSQL database, authentication, and storage
- **Next.js API Routes** - Serverless API endpoints
- **Cloudflare Workers AI** - AI agent infrastructure with Durable Objects

### Blockchain
- **Arc Network** - Layer-1 blockchain optimized for stablecoin payments
- **Circle Technologies**:
  - Developer Controlled Wallets (automated refunds)
  - Bridge Kit (cross-chain transfers)
  - Gateway (instant cross-chain transfers)
  - Paymaster (gasless transactions)
- **Account Abstraction** - EIP-7702 with Pimlico Bundler

### Smart Contracts
- **Foundry** - Smart contract development framework
- **PayRouter** - Payment routing contract
- **MockUSDC** - Test USDC token for Arc Testnet

### AI & Voice
- **Cloudflare Workers AI** - AI agent framework
- **ElevenLabs** - Voice cloning and synthesis

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Circle account (for automated refunds)
- ElevenLabs account (for voice previews)
- Vercel account (for deployment)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd arc
npm install
```

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Arc Network
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network

# Circle (for automated refunds)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret

# ElevenLabs (for voice previews)
ELEVENLABS_API_KEY=your_elevenlabs_key

# Cloudflare Agents
NEXT_PUBLIC_CLOUDFLARE_AGENTS_HOST=your_workers_host
```

See [VERCEL_ENV_VARIABLES.md](./VERCEL_ENV_VARIABLES.md) for a complete list.

### 3. Database Setup

Run the Supabase migrations:

1. Go to your Supabase project SQL Editor
2. Run the migrations in order:
   - `supabase-schema.sql`
   - `migrations/add_refund_settings.sql`
   - `migrations/add_chain_id_to_refunds.sql`
   - `migrations/add_circle_transaction_id_to_refunds.sql`

See [SUPABASE_QUICK_START.md](./SUPABASE_QUICK_START.md) for detailed instructions.

### 4. Deploy Smart Contracts

```bash
# Deploy to Arc Testnet
forge script script/DeployMockUSDC.s.sol:DeployMockUSDC --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
forge script script/DeployPayRouter.s.sol:DeployPayRouter --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

Update contract addresses in `.env.local` after deployment.

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

- **[FEATURES.md](./FEATURES.md)** - Complete feature overview and business value
- **[SUPABASE_QUICK_START.md](./SUPABASE_QUICK_START.md)** - Database setup guide
- **[CIRCLE_REFUND_SETUP.md](./CIRCLE_REFUND_SETUP.md)** - Circle wallet setup for automated refunds
- **[CLOUDFLARE_AGENTS_SETUP.md](./CLOUDFLARE_AGENTS_SETUP.md)** - AI agent setup
- **[VERCEL_ENV_VARIABLES.md](./VERCEL_ENV_VARIABLES.md)** - Environment variables for Vercel
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide

## 🧪 Development

### Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server

# Smart Contracts
forge build          # Build contracts
forge test           # Run tests
forge fmt            # Format Solidity code
forge script script/DeployPayRouter.s.sol:DeployPayRouter --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Project Structure

```
arc/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── creator/        # Creator dashboard pages
│   └── p/              # Public post pages
├── components/         # React components
├── lib/                # Utilities and configurations
├── contracts/          # Smart contracts
├── src/                # Additional Solidity contracts
├── migrations/         # Database migrations
└── workers/            # Cloudflare Workers AI code
```

## 🌐 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables (see [VERCEL_ENV_VARIABLES.md](./VERCEL_ENV_VARIABLES.md))
4. Deploy

The build will automatically:
- Install dependencies
- Run `forge fmt --check` (formatting check)
- Build Next.js application
- Deploy to Vercel

### Environment Variables

Make sure to add all required environment variables in Vercel:
- Production environment
- Preview environment (optional)
- Development environment (optional)

See [VERCEL_ENV_VARIABLES.md](./VERCEL_ENV_VARIABLES.md) for the complete list.

## 🔗 Key Links

- **Arc Network**: [https://www.arc.network/](https://www.arc.network/)
- **Circle Console**: [https://console.circle.com/](https://console.circle.com/)
- **Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
- **Cloudflare Workers**: [https://workers.cloudflare.com/](https://workers.cloudflare.com/)

## 🤝 Contributing

This is a private project. For questions or issues, please contact the maintainers.
