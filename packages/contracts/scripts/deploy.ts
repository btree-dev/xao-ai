import { ethers } from "hardhat";

async function main() {
  const Contract = await ethers.getContractFactory("PerformanceAgreementNFT");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  console.log("PerformanceAgreementNFT deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
