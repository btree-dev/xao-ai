# XAO Monorepo

This repository contains multiple packages managed with pnpm workspaces.

## Workspace Layout
```
packages/
  contracts/        # Hardhat + Solidity sources
  agent/            # Virtuals AI agent code
  shared/           # Shared TypeScript types (AgreementInput validation)
apps/
  web/              # React + Vite web UI for agreement signing/minting
```

## Getting Started
Install all dependencies:
```
pnpm install
```

## Scripts (run from root)
```
pnpm compile:contracts          # Compile solidity
pnpm test:contracts             # Run contract tests
pnpm dev:agent                  # Start agent in dev (ts-node)
pnpm build:agent                # Build agent (tsc)
pnpm dev:web                    # Run web UI (Vite)
pnpm build:web                  # Build web UI
```

## Contracts Package (@xao/contracts)
- ERC721 `PerformanceAgreementNFT` with payment terms, status lifecycle, and EIP-712 signature mint (`createAgreementWithArtistSig`).
- Located in `packages/contracts/contracts/PerformanceAgreementNFT.sol`.
- Hardhat config: `packages/contracts/hardhat.config.ts`.
 - Detailed docs: `packages/contracts/README.md`

## Web App (apps/web)
- Provides UI for drafting agreement, artist EIP-712 signing, venue submission.
- Requires deployed contract address pasted manually.

## Agent Package (@xao/agent)
- Integrates Twitter worker and other plugins.

## Development Flow
1. Deploy contract locally:
```
pnpm --filter @xao/contracts hardhat node
pnpm --filter @xao/contracts hardhat run packages/contracts/scripts/deploy.ts --network localhost
```
2. Copy contract address into web UI.
3. Use web UI to sign & mint agreement.

## Environment Variables
Create `.env` at root for agent & contract network settings.
```
VIRTUALS_API_TOKEN=...
GAME_TWITTER_ACCESS_TOKEN=...
ALCHEMY_API_KEY=...
BASE_RPC_URL=...
DEPLOYER_KEY=0x...
```

## Monorepo Tips
- Use `pnpm --filter <package>` to target a specific package.
- Recursive commands: `pnpm -r run build` builds all packages that define a build script.
- Add shared code in a new `packages/shared` package if needed.

## Future Improvements
- Add CI workflow (GitHub Actions) for compile + test.
- Add linting (ESLint + Prettier) at workspace root.
- Add deployment scripts for testnet/mainnet.
- Persist agreement drafts in web app localStorage.

## License
MIT
