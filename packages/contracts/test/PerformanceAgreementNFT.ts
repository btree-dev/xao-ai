import { expect } from "chai";
import { ethers } from "hardhat";

describe("PerformanceAgreementNFT", function () {
  it("should create an agreement and return its data", async () => {
    const Contract = await ethers.getContractFactory("PerformanceAgreementNFT");
    const contract = await Contract.deploy();
    await contract.waitForDeployment();

    const [deployer, artist, venue] = await ethers.getSigners();

    const tx = await contract.connect(deployer).createAgreement(
      "Cool Venue",
      "123 Blockchain Ave",
      Math.floor(Date.now() / 1000) + 3600,
      120,
      "@artist_handle",
      "@venue_handle",
      artist.address,
      venue.address,
      25000 // $250.00 in cents
    );
    const receipt = await tx.wait();

    const tokenId = receipt?.logs?.[0]?.args?.tokenId || 1; // fallback

    const agreement = await contract.getAgreement(tokenId);
    expect(agreement.venueName).to.equal("Cool Venue");
    expect(agreement.artistWallet).to.equal(artist.address);
    expect(agreement.venueWallet).to.equal(venue.address);
    expect(agreement.paymentAmountUsdCents).to.equal(25000n);
    expect(agreement.status).to.equal(0); // Scheduled

    await contract.connect(artist).markCompleted(tokenId);
    expect((await contract.getAgreement(tokenId)).status).to.equal(1);

    await contract.connect(venue).raiseDispute(tokenId);
    expect((await contract.getAgreement(tokenId)).status).to.equal(2);

    await contract.resolveDispute(tokenId);
    expect((await contract.getAgreement(tokenId)).status).to.equal(3);

    await contract.connect(venue).recordPayment(tokenId);
    expect((await contract.getAgreement(tokenId)).paymentRecorded).to.equal(true);
  });
});
