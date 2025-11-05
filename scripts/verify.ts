import { run } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const contractAddress = process.env.PAYROUTER_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  const feeReceiver = process.env.FEE_RECEIVER_ADDRESS || process.env.CREATOR_ADDRESS;
  const feeBps = process.env.FEE_BPS || '250';

  if (!contractAddress) {
    throw new Error('PAYROUTER_ADDRESS not set in .env file');
  }

  console.log('🔍 Verifying PayRouter contract...');
  console.log(`   Address: ${contractAddress}\n`);

  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: [
        usdcAddress,
        feeReceiver,
        Number(feeBps),
      ],
    });
    console.log('✅ Contract verified successfully!');
  } catch (error: any) {
    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract already verified!');
    } else {
      console.error('❌ Verification failed:', error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

