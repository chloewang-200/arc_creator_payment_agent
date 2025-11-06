import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    arc: {
      url: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
      chainId: 5042002, // Arc Testnet (correct chain ID)
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    hardhat: {
      chainId: 1337,
    },
  },
  etherscan: {
    apiKey: {
      arc: process.env.ARC_EXPLORER_API_KEY || '',
    },
    customChains: [
      {
        network: 'arc',
        chainId: 5042002, // Arc Testnet (correct chain ID)
        urls: {
          apiURL: 'https://testnet.arcscan.app/api',
          browserURL: 'https://testnet.arcscan.app',
        },
      },
    ],
  },
};

export default config;

