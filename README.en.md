[English](README.en.md) | [한국어](README.md)

# Cysic Auto Manager

A multi-wallet automation tool for the Cysic mainnet.
**Claim staking rewards → Collect into a main wallet → Bridge to BNB Chain** — all in a few commands.

Replaces the tedious manual flow of opening Keplr for each wallet, claiming rewards, transferring to a main wallet, and finally bridging to BNB.

## What it does

| Command | Action |
|---|---|
| `npm run balance` | Show balance and pending rewards for every wallet |
| `npm run claim` | Claim staking rewards across all wallets in one go |
| `npm run collect` | Move CYS from sub-wallets to the main wallet |
| `npm run bridge -- 5` | Bridge 5 CYS from the main wallet to BNB Chain |
| `npm run run-all -- 5` | Run the above four steps sequentially |
| `npm run doctor` | Self-diagnose security posture |

## How it works

Cysic is a **dual-stack chain — Ethermint built on top of the Cosmos SDK** (chain id `cysicmint_4399-1`, EVM chain id `4399`). Keplr sends standard Cosmos-side `MsgWithdrawDelegatorReward` / `MsgSend` transactions for staking and transfer; the bridge calls a contract on the EVM side via `withdraw()`. This tool reproduces those exact flows automatically.

Stack:
- **TypeScript + Node.js**
- **CosmJS** (`@cosmjs/stargate`, `@cosmjs/proto-signing`) for Cosmos-side transactions
- **ethers.js v6** for EVM-side bridge contract calls
- **Custom Ethermint signer** — Cysic uses its own pubkey type URL `/cysicmint.crypto.v1.ethsecp256k1.PubKey` and Keccak256 signing

Cysic is **not standard Ethermint** — it uses its own namespace, so generic CosmJS or Evmos SDKs alone will have their transactions rejected. This tool bridges that gap.

## Prerequisites

### 1. Install

```bash
git clone <this-repo>
cd cysic-auto-manager
npm install
```

Requires Node.js 18 or later.

### 2. Environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

- **`MAIN_WALLET_ADDRESS`** — Your main wallet's bech32 address (`cysic1...`)
- **`BRIDGE_RECIPIENT_BNB_ADDRESS`** — Your `0x...` address on BNB Chain that will receive the bridged CYS BEP-20.
  (Using an EVM address controlled by the same key as your Cysic account lets a single mnemonic work on both sides.)
- The rest can stay at defaults.

### 3. Wallet mnemonics (most important)

**Mnemonics are stored in the `.secrets/` folder, one per file — NOT in `.env`.**

```bash
# The .secrets/ directory is protected by .gitignore
notepad .secrets/main.mnemonic        # main wallet
notepad .secrets/wallet-1.mnemonic    # sub-wallet 1
notepad .secrets/wallet-2.mnemonic    # sub-wallet 2 ... (as many as you have)
```

Each file should contain only the 12 or 24 BIP-39 words on a single line:
```
word1 word2 word3 ... word12
```
No quotes, comments, or blank lines.

### 4. First-run verification

```bash
npm run doctor          # security self-check (all OK?)
npm run balance         # do the addresses and amounts match what you see in Keplr?
```

If `balance` shows the same addresses and amounts you see in Keplr, the entire pipeline is wired correctly.

## Usage

```bash
npm run balance              # all wallets: balance + pending rewards
npm run claim                # claim staking rewards from every wallet
npm run collect              # move CYS to the main wallet
npm run bridge -- 5          # bridge 5 CYS to BNB
npm run run-all -- 5         # everything in sequence
```

Arguments after `--` are forwarded to the CLI by npm.

### Start with DRY_RUN

With `DRY_RUN=true` in `.env`, every command simulates without broadcasting. Run each command once in dry-run mode, confirm the logs look reasonable, then switch to `DRY_RUN=false` for real execution.

## Security

This tool signs transactions with **your mnemonics**. Leaking them means permanent loss of funds. Follow these rules.

### Protections that ship with the project

1. **`.secrets/` separation** — mnemonics live in a directory distinct from `.env`. The code reads only this folder.
2. **Multi-pattern `.gitignore`** — excludes `.env`, `.env.*`, `.secrets/`, `*.mnemonic`, `*.key`, `*.pem`, `keystore/`, `wallets.json`.
3. **Claude Code PreToolUse hook** (`.claude/hooks/block-secrets.ps1`) — blocks AI coding tools from touching secret files.
4. **Runtime masking** (`src/utils/secret-guard.ts`) — `console.log(mnemonic)` is auto-redacted even if it happens by accident.
5. **CLAUDE.md** — explicit rules for AI agents that work in this repo.

### Rules you must follow

- **Never paste a mnemonic into chat, email, messengers, AI assistants, etc.**
- **Never zip and upload `.secrets/` or `.env` to cloud or third parties.**
- **Any `.bak` file that contains plaintext mnemonic must be securely deleted.**
- Run `npm run doctor` frequently to check security posture.

### Threat surface

This tool runs locally on your machine and never sends mnemonics to external services. RPC traffic is one-way (your machine → Cysic public RPC); signing happens on-device.

That said, if your PC itself is compromised, `.secrets/` is exposed. For additional protection:
- Run on an isolated PC or VM
- Keep only freshly-claimed CYS in the main wallet, not large reserves
- Periodically `npm run doctor` to catch backup-file residue

## Folder layout

```
cysic-auto-manager/
├─ src/
│  ├─ index.ts                     # CLI entry (commander)
│  ├─ config/
│  │  ├─ chains.ts                 # chain config (lazy load)
│  │  └─ wallets.ts                # mnemonic loader (.secrets/ only)
│  ├─ wallet/
│  │  ├─ cosmos.ts                 # ResolvedWallet builder
│  │  ├─ ethermint-signer.ts       # Cysic-compatible OfflineDirectSigner
│  │  └─ evm.ts                    # ethers provider/wallet helpers
│  ├─ cosmos/
│  │  ├─ client.ts                 # Stargate client
│  │  ├─ account.ts                # EthAccount-aware lookup
│  │  ├─ balance.ts                # balance + pending rewards
│  │  ├─ claim.ts                  # withdraw reward
│  │  ├─ transfer.ts               # MsgSend
│  │  └─ ethermint-tx.ts           # manual tx build + sign + broadcast
│  ├─ bridge/
│  │  └─ cysic-to-bnb.ts           # bridge contract call
│  ├─ commands/                    # CLI sub-commands
│  └─ utils/
│     ├─ logger.ts                 # colorized logger + file output
│     ├─ retry.ts                  # retry wrapper
│     ├─ format.ts                 # amount formatting
│     └─ secret-guard.ts           # runtime mnemonic redaction
├─ scripts/
│  ├─ doctor.ts                    # security self-check
│  └─ migrate-to-secrets.ts        # move legacy .env mnemonics to .secrets/
├─ .claude/
│  ├─ settings.local.json          # AI hook registration
│  └─ hooks/
│     └─ block-secrets.ps1         # blocks AI from reading secret files
├─ .secrets/                       # mnemonic store (gitignored, only README tracked)
│  └─ README.md
├─ logs/                           # daily transaction logs (gitignored)
├─ .env.example                    # env template (tracked)
├─ .env                            # actual env (gitignored)
├─ .gitignore
├─ CLAUDE.md / CLAUDE.en.md        # AI agent rules
├─ tsconfig.json
├─ package.json
├─ LICENSE
└─ README.md / README.en.md
```

## Verified information (as of May 2026)

| Item | Value |
|---|---|
| Cosmos chain id | `cysicmint_4399-1` |
| EVM chain id | `4399` |
| RPC (Cosmos) | `https://rpc.cysic.xyz` |
| LCD / REST | `https://rest.cysic.xyz` |
| EVM JSON-RPC | `https://rpc-evm.cysic.xyz` |
| Explorer (EVM) | `https://explorer-evm.cysic.xyz` |
| Bech32 prefix | `cysic` |
| Mint denom (rewards) | `CYS` (18 decimals) |
| Stake denom | `CGT` |
| PubKey type URL | `/cysicmint.crypto.v1.ethsecp256k1.PubKey` |
| HD path | `m/44'/60'/0'/0/0` (Ethereum) |
| Address derivation | Keccak256 → 20 bytes → bech32 |
| Sign hash | Keccak256 (NOT SHA256) |
| Min gas price | 7 unit/gas (integer) |
| Unbonding | 21 days |
| Bridge proxy (Cysic side) | `0x127e8564bF37d179Bf6cC57a6209a3dacB6F9045` |
| Bridge fee (Cysic → BNB) | ~2 CYS, flat |
| CYS BEP-20 (BNB side) | `0x0C69199C1562233640e0Db5Ce2c399A88eB507C7` |

## Known limitations

- **Flat 2 CYS bridge fee** — sending small amounts is inefficient. Batch rewards and bridge in one larger transaction.
- **21-day unbonding** — undelegating CGT requires waiting 21 days before CYS can be reclaimed.
- **`tokenCanOperation` view semantics unclear** — excluded from preflight checks (a successful `estimateGas` covers it in practice).
- **No official Cysic SDK** — this tool implements the protocol directly because no library exists.

## Contributing

Issues and PRs welcome. Please verify that no mnemonic-like content ends up in code, logs, or examples before submitting.

## Disclaimer

This tool is provided for personal automation. **It carries no liability for asset loss.** Before any real use:
1. Simulate with `DRY_RUN=true`
2. Verify with a small live transaction
3. Confirm your local mnemonic storage is secure

In particular, **bridge contract addresses encoded here are accurate as of authoring time** and may change. For large transfers, cross-check against the official UI (https://app.cysic.xyz/bridge) before sending.

## License

MIT
