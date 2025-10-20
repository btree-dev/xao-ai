import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
      // accounts: automatically provided by hardhat node; if using external node, uncomment below
      // accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : undefined,
    },
    // example: base testnet
    // base: {
    //   url: process.env.BASE_RPC_URL || "",
    //   accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    // }
  },
};

module.exports = config;
