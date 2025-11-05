#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnv() {
  console.log('🔧 Arc Creator Platform - Environment Setup\n');

  const envPath = path.join(process.cwd(), '.env.local');
  
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  .env.local already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ Cancelled.');
      rl.close();
      return;
    }
  }

  console.log('\n📝 Please provide the following information:\n');

  // Frontend Configuration
  const creatorAddress = await question('1. Creator wallet address (where payments go): ');
  const dynamicEnvId = await question('2. Dynamic Environment ID (get from https://app.dynamic.xyz/): ');
  const crossmintKey = await question('3. Crossmint API Key (optional, press Enter to skip): ');

  // Deployment Configuration
  console.log('\n🔐 Deployment Configuration (for contract deployment):');
  const privateKey = await question('4. Deployer private key (0x...): ');
  const usdcAddress = await question('5. USDC token address on Arc: ');
  const feeReceiver = await question(`6. Fee receiver address (press Enter to use creator address [${creatorAddress}]): `) || creatorAddress;
  const feeBps = await question('7. Fee in basis points (default 250 = 2.5%): ') || '250';

  const envContent = `# Arc Network Configuration
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.arc.network

# Contract Addresses (update after deployment)
NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}
NEXT_PUBLIC_PAYROUTER_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_CREATOR_ADDRESS=${creatorAddress}

# Wallet Provider Configuration
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=${dynamicEnvId}
${crossmintKey ? `NEXT_PUBLIC_CROSSMINT_API_KEY=${crossmintKey}` : '# NEXT_PUBLIC_CROSSMINT_API_KEY=your_crossmint_api_key'}

# Deployment Configuration (for Hardhat - keep this private!)
PRIVATE_KEY=${privateKey}
ARC_RPC_URL=https://rpc.arc.network
USDC_ADDRESS=${usdcAddress}
FEE_RECEIVER_ADDRESS=${feeReceiver}
FEE_BPS=${feeBps}
`;

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ .env.local file created successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Review .env.local to make sure everything is correct');
  console.log('   2. Run: npm run deploy:payrouter');
  console.log('   3. Update NEXT_PUBLIC_PAYROUTER_ADDRESS in .env.local with the deployed address');
  console.log('   4. Run: npm run dev\n');

  rl.close();
}

setupEnv().catch((error) => {
  console.error('❌ Error:', error.message);
  rl.close();
  process.exit(1);
});

