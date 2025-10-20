# Web UI (apps/web)

React + Vite application for creating and minting `PerformanceAgreementNFT` agreements.

## Features
- Draft agreement details (venue, time, payment, social handles).
- Artist signs agreement off-chain via EIP-712 typed data.
- Venue submits signed data to mint NFT to artist wallet.

## Scripts
Run from repo root:
```
pnpm dev:web      # start Vite dev server
pnpm build:web    # production build
```
Or inside this directory:
```
pnpm install
pnpm dev
```

## Contract Interaction
Paste deployed contract address (from `@xao/contracts` deployment) into the UI.

## Typed Data Domain
```
name: PerformanceAgreementNFT
version: 1
chainId: (detected from provider)
verifyingContract: <your contract address>
```

## AgreementInput Fields
```
venueName              string
venueAddress           string
startTime              uint64 (unix seconds)
durationMinutes        uint32
artistSocialHandle     string
venueSocialHandle      string
artistWallet           address
venueWallet            address
paymentAmountUsdCents  uint256
```

## Roadmap
- Pull contract address automatically from env/config.
- Display token metadata after mint (fetch `tokenURI`).
- Add lifecycle action buttons (complete, dispute, resolve, record payment).
- Local draft persistence (localStorage).
- Validation & error surfacing for addresses/time.

## Security Notes
- EIP-712 domain prevents replay across chains/contracts.
- Consider adding a unique nonce/salt for each agreement to prevent duplicate struct reuse.
