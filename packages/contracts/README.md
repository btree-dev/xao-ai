# PerformanceAgreementNFT

An ERC-721 smart contract representing a performance agreement between an artist and a venue. Each minted token stores structured metadata on-chain.

## Agreement Fields
- venueName (string)
- venueAddress (string)
- startTime (uint64, unix timestamp seconds)
- durationMinutes (uint32)
- artistSocialHandle (string)
- venueSocialHandle (string)
- artistWallet (address)
- venueWallet (address)
- paymentAmountUsdCents (uint256) – agreed payment in USD cents
- status (enum: Scheduled, Completed, Disputed, Resolved)
- paymentRecorded (bool)

## Key Functions
- `createAgreement(...)` – mints a new NFT and records the agreement with initial status `Scheduled`.
- `createAgreementWithArtistSig(AgreementInput, signature)` – venue mints using artist's EIP-712 off-chain signature.
- `markCompleted(tokenId)` – either participant marks event completed.
- `raiseDispute(tokenId)` – participant raises dispute after completion.
- `resolveDispute(tokenId)` – contract owner resolves dispute (status -> Resolved).
- `recordPayment(tokenId)` – participant records payment (only in Completed or Resolved state, one-time).
- `getAgreement(tokenId)` – returns the stored struct.
- `tokenURI(tokenId)` – returns a base64 JSON data URI of agreement metadata including status & payment.

## Development (Hardhat)

### Install (workspace root)
```
pnpm install
```

### Compile
```
pnpm --filter @xao/contracts hardhat compile
```

### Run Tests
```
pnpm --filter @xao/contracts hardhat test
```

### Deploy (Local)
```
pnpm --filter @xao/contracts hardhat node
# in new terminal
pnpm --filter @xao/contracts hardhat run packages/contracts/scripts/deploy.ts --network localhost
```

### Example Mint Script
```ts
const tx = await contract.createAgreement(
  "My Venue",
  "42 Music Rd",
  Math.floor(Date.now()/1000) + 3600,
  180,
  "@artist_social",
  "@venue_social",
  artistAddress,
  venueAddress,
  50000 // $500.00 in cents
);
```

### Example EIP-712 Typed Data (Frontend)
```ts
const domain = {
  name: 'PerformanceAgreementNFT',
  version: '1',
  chainId,
  verifyingContract: contractAddress
};
const types = {
  AgreementInput: [
    { name: 'venueName', type: 'string' },
    { name: 'venueAddress', type: 'string' },
    { name: 'startTime', type: 'uint64' },
    { name: 'durationMinutes', type: 'uint32' },
    { name: 'artistSocialHandle', type: 'string' },
    { name: 'venueSocialHandle', type: 'string' },
    { name: 'artistWallet', type: 'address' },
    { name: 'venueWallet', type: 'address' },
    { name: 'paymentAmountUsdCents', type: 'uint256' }
  ]
};
```

## Notes
- Duration limited to 24 hours (1440 minutes).
- Start time must not be in the distant past.
- Metadata is on-chain; consider emitting more events for indexing.
- For production, consider off-chain tokenURI or IPFS storage for larger metadata.

## Future Enhancements
- Add on-chain escrow in stablecoin (USDC) and conditional release.
- Add cancellation flow before start time.
- Add oracle-based verification of event completion (e.g., Chainlink).
- Add nonce/salt to typed data to prevent replay.
- Upgrade to use ERC-5192 (soulbound) if transferability should be restricted.

## License
MIT
