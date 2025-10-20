# Deploying PerformanceAgreementNFT to Base Sepolia

## Prerequisites
- Node.js & pnpm installed
- Funded Base Sepolia account (get test ETH from Base Sepolia faucet)
- Private key exported (no leading 0x stripping)
- RPC endpoint (public https://sepolia.base.org or provider like Alchemy/Infura)

## Environment Variables (.env)
```
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0xYOURPRIVATEKEY
VITE_CONTRACT_ADDRESS_BASE_SEPOLIA= # will populate after deploy
VITE_TARGET_CHAIN_ID=84532
```

## Compile & Deploy
From contracts package root:
```
pnpm --filter @xao/contracts hardhat compile
pnpm --filter @xao/contracts hardhat run scripts/deploy-base-sepolia.ts --network baseSepolia
```
Output will show deployed address. Copy it and set `VITE_CONTRACT_ADDRESS_BASE_SEPOLIA` in `.env` at workspace root (or web app env file).

## Verify (Optional)
```
pnpm --filter @xao/contracts hardhat verify --network baseSepolia <DEPLOYED_ADDRESS>
```
(Requires contract arguments; constructor has none.)

## Frontend Configuration
Web app reads:
- `VITE_CONTRACT_ADDRESS_BASE_SEPOLIA` for contract address
- `VITE_TARGET_CHAIN_ID` for chain id (84532)

After updating `.env` run web build/dev:
```
pnpm --filter @xao/web dev
```

## Wallet Setup
Add custom network in MetaMask:
- Network name: Base Sepolia
- RPC URL: https://sepolia.base.org
- Chain ID: 84532
- Currency symbol: ETH
- Block explorer: https://sepolia.basescan.org

## Troubleshooting
- "Wrong network": ensure MetaMask on chain 84532.
- Empty contract code: confirm deployment address matches `VITE_CONTRACT_ADDRESS_BASE_SEPOLIA`.
- Circuit breaker/open: reduce failing calls; verify RPC URL reachable.

## Updating
Re-deploy new version -> update env contract address -> rebuild frontend.
