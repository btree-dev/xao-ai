import { ethers, network } from "hardhat";

async function main() {
  // Ensure we actually have accounts (Hardhat only injects those explicitly configured for live networks)
  const signers = await ethers.getSigners();
  if (!signers.length) {
    const hasEnv = !!process.env.DEPLOYER_PRIVATE_KEY;
    throw new Error(
      `No signers available for network '${network.name}'.\n` +
      `DEPLOYER_PRIVATE_KEY set: ${hasEnv ? 'yes' : 'no'}\n` +
      `Fix: create packages/contracts/.env with DEPLOYER_PRIVATE_KEY=0x... (funded Base Sepolia key) or export it in your shell.`
    );
  }
  const deployer = signers[0];
  console.log("Network:", network.name, "(chainId:", network.config.chainId, ")");
  console.log("Deploying with:", deployer.address);
  const bal = await deployer.provider!.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(bal), "ETH");
  if (bal === 0n) {
    console.warn("WARNING: Deployer balance is 0. Deployment will fail due to insufficient funds.");
  }

  const Contract = await ethers.getContractFactory("PerformanceAgreementNFT");
  const contract = await Contract.deploy();
  await contract.waitForDeployment(); // ethers v6 pattern replaces .deployed()
  const address = await contract.getAddress();
  console.log("PerformanceAgreementNFT deployed to:", address);
  console.log("Set VITE_CONTRACT_ADDRESS_BASE_SEPOLIA=", address, "then restart the web app.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
