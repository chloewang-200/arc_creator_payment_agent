import type { Post } from '@/types';

export const posts: Post[] = [
  {
    id: '1',
    title: 'The Future of Web3 Payments',
    intro: 'As we move into 2024, the landscape of decentralized payments is evolving rapidly. Traditional payment rails are being challenged by blockchain-based solutions that offer...',
    body: `As we move into 2024, the landscape of decentralized payments is evolving rapidly. Traditional payment rails are being challenged by blockchain-based solutions that offer transparency, lower fees, and global accessibility.

The rise of stablecoins like USDC has been particularly transformative. With USDC on Arc, we're seeing transaction costs drop to fractions of a cent while maintaining the security and decentralization of blockchain technology.

One of the most exciting developments is the integration of account abstraction, which allows users to interact with blockchain applications without needing to manage complex wallet setups. This lowers the barrier to entry significantly.

Looking ahead, we can expect to see more seamless integration between traditional finance and DeFi, with protocols like Arc serving as the bridge. The future of payments is not just decentralized—it's user-friendly and accessible to everyone.

The key to adoption will be creating experiences that feel as natural as using a credit card, while providing the benefits of blockchain technology. We're already seeing this with embedded wallets and social logins.`,
    priceUSD: 0.69,
    includedInSubscription: true,
    creatorId: 'creator1',
    createdAt: '2024-01-15T10:00:00Z',
    contentType: 'post',
  },
  {
    id: '2',
    title: 'Building Creator Economies on Arc',
    intro: 'Creator platforms are ripe for disruption. The current model of taking 30-50% cuts from creators is unsustainable. Blockchain technology offers a new path forward...',
    body: `Creator platforms are ripe for disruption. The current model of taking 30-50% cuts from creators is unsustainable. Blockchain technology offers a new path forward.

On Arc, creators can accept payments directly in USDC, with minimal fees and no intermediaries taking large cuts. This means more money goes directly to the people creating value.

The platform we've built demonstrates how simple this can be. With just a few clicks, readers can unlock content, subscribe monthly, or tip creators directly. All transactions are transparent and verifiable on-chain.

But it's not just about payments. The AI avatar system allows creators to scale their engagement with readers, answering questions and facilitating orders 24/7. This creates a more interactive and personalized experience.

As we continue to build, we're focusing on making the entire experience seamless. The goal is to make blockchain payments feel as natural as using any modern payment method, while providing the transparency and creator-friendly economics that blockchain enables.

The future of creator economies is decentralized, transparent, and creator-first. And it's happening now on Arc.`,
    priceUSD: 0.99,
    includedInSubscription: true,
    creatorId: 'creator1',
    createdAt: '2024-01-20T14:30:00Z',
    contentType: 'post',
  },
  {
    id: '3',
    title: 'Account Abstraction: The Next Wave',
    intro: 'Account abstraction is revolutionizing how users interact with blockchain applications. By abstracting away the complexity of wallet management...',
    body: `Account abstraction is revolutionizing how users interact with blockchain applications. By abstracting away the complexity of wallet management, we're making blockchain accessible to mainstream users.

The concept is simple: instead of requiring users to manage private keys and seed phrases, account abstraction allows applications to manage these complexities on behalf of users. This is done through smart contract wallets that can implement custom logic.

On Arc, we're leveraging account abstraction through providers like Dynamic and Crossmint. Users can create wallets with just an email or social login, and the underlying MPC (Multi-Party Computation) technology ensures security.

This technology enables new use cases that weren't possible before. Gasless transactions, social recovery, spending limits, and more are all possible with account abstraction.

As more platforms adopt these technologies, we'll see a shift from "blockchain-native" to "blockchain-enabled" applications. The blockchain will become invisible to users, while still providing all the benefits of decentralization.

The future is bright for account abstraction, and Arc is at the forefront of this movement.`,
    priceUSD: 1.49,
    includedInSubscription: true,
    creatorId: 'creator1',
    createdAt: '2024-01-25T09:15:00Z',
    contentType: 'post',
  },
  {
    id: '4',
    title: 'Episode 12: Stablecoins and Real-World Assets',
    intro: 'In this episode, we explore how stablecoins are bridging the gap between traditional finance and DeFi...',
    body: `In this episode, we explore how stablecoins are bridging the gap between traditional finance and DeFi.

We discuss the role of USDC as a bridge asset, the importance of regulatory clarity, and how real-world assets are being tokenized on-chain.

Our guest this week is a leading expert in stablecoin infrastructure who shares insights on the future of digital payments.

Topics covered:
- The evolution of stablecoins
- Regulatory landscape
- Real-world asset tokenization
- Cross-chain interoperability
- Future of digital payments

Tune in for an in-depth conversation about the infrastructure powering the next generation of financial applications.`,
    priceUSD: 1.99,
    includedInSubscription: true,
    creatorId: 'creator3',
    createdAt: '2024-01-28T12:00:00Z',
    contentType: 'podcast',
  },
];
