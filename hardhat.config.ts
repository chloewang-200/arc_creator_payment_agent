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
      url: process.env.ARC_RPC_URL || 'https://rpc.arc.network',
      chainId: 1243,
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
        chainId: 1243,
        urls: {
          apiURL: 'https://explorer.arc.network/api',
          browserURL: 'https://explorer.arc.network',
        },
      },
    ],
  },
};

export default config;

