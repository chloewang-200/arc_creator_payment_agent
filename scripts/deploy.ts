import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Deploying PayRouter contract...\n');

  // Get deployment parameters from environment
  const usdcAddress = process.env.USDC_ADDRESS;
  const feeReceiver = process.env.FEE_RECEIVER_ADDRESS || process.env.CREATOR_ADDRESS;
  const feeBps = process.env.FEE_BPS || '250'; // Default 2.5%

  if (!usdcAddress) {
    throw new Error('USDC_ADDRESS not set in .env file');
  }

  if (!feeReceiver) {
    throw new Error('FEE_RECEIVER_ADDRESS or CREATOR_ADDRESS not set in .env file');
  }

  console.log('📋 Deployment Parameters:');
  console.log(`   USDC Address: ${usdcAddress}`);
  console.log(`   Fee Receiver: ${feeReceiver}`);
  console.log(`   Fee BPS: ${feeBps} (${Number(feeBps) / 100}%)\n`);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('👤 Deploying from address:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH\n');

  // Deploy PayRouter
  const PayRouter = await ethers.getContractFactory('PayRouter');
  console.log('📦 Deploying PayRouter...');
  
  const payRouter = await PayRouter.deploy(
    usdcAddress,
    feeReceiver,
    Number(feeBps)
  );

  await payRouter.waitForDeployment();
  const address = await payRouter.getAddress();

  console.log('\n✅ PayRouter deployed successfully!');
  console.log('📍 Contract Address:', address);
  console.log('\n📝 Next steps:');
  console.log(`   1. Update .env.local with: NEXT_PUBLIC_PAYROUTER_ADDRESS=${address}`);
  console.log(`   2. Verify contract on explorer: https://explorer.arc.network/address/${address}`);
  console.log(`   3. Test the contract with a small payment\n`);

  // Verify contract details
  console.log('🔍 Contract Verification:');
  console.log(`   USDC: ${await payRouter.USDC()}`);
  console.log(`   Fee Receiver: ${await payRouter.feeReceiver()}`);
  console.log(`   Fee BPS: ${await payRouter.feeBps()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  });

