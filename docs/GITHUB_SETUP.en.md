[English](GITHUB_SETUP.en.md) | [한국어](GITHUB_SETUP.md)

# Pushing safely to GitHub

This document is a step-by-step guide for getting this project onto GitHub **without leaking your mnemonic or personal addresses**.

## 0. Preflight (mandatory before push)

```bash
npm run doctor
```

**Every check must be OK** before continuing. In particular:
- No missing patterns in `.gitignore`
- No plaintext mnemonic in `.env`
- `.secrets/*.mnemonic` files exist (locally only)
- No `.env.bak-*` backup files

If anything is `FAIL`, do not push. Resolve `WARN`s where possible too.

## 1. Initialize git locally

```powershell
cd <project_root>
git init
git branch -M main
```

## 2. Verify what will be committed

```powershell
git add .
git status                  # review staged file list
```

**The following must NOT appear in the staged list:**
- `.env`
- Any `.env.bak-*` backup
- `.secrets/main.mnemonic`, `.secrets/wallet-*.mnemonic`
- Any other `.mnemonic`, `.key`, `.pem`, `keystore/`, `wallets.json`

`.gitignore` blocks them automatically, but **verify with your own eyes**.

Quick check command:
```powershell
git ls-files | Select-String -Pattern "\.env|\.secrets|mnemonic|\.key|\.pem"
```
→ Empty output is safe. If anything appears (other than `.env.example` or `.secrets/README.md`), abort.

## 3. Doctor again (after git init)

```bash
npm run doctor
```

Now that `.git` exists, doctor also runs the "git push safety" check. If any staged secret files are detected here, it's a **FAIL**. **Do not push on FAIL.**

## 4. First commit

```powershell
git add .
git status                  # double-check
git commit -m "Initial commit: Cysic Auto Manager"
```

If commit fails with "Author identity unknown", set your identity:
```powershell
git config --global user.name "your-name"
git config --global user.email "you@example.com"
```
For email privacy, use GitHub's noreply email (find it at https://github.com/settings/emails).

## 5. Create GitHub repo and push

On https://github.com/new create a **new empty repo** (do NOT initialize with README/license/.gitignore — we already have them):

```powershell
git remote add origin https://github.com/<USERNAME>/cysic-auto-manager.git
git push -u origin main
```

If you intend to make the repo **public**, do one last secrets scan:

```powershell
# grep for secret-like patterns — should print nothing
git grep -i "mnemonic\|0x[a-f0-9]\{64\}"
```

Also visually scan for any 12/24-word English phrases that may have slipped in.

## 6. Post-push verification

In the GitHub web UI, confirm:
- [ ] No `.env` file in the repo
- [ ] `.secrets/` folder contains only `README.md` — no `.mnemonic` files
- [ ] `README.md` and `LICENSE` render correctly
- [ ] No personal env vars exposed under Actions / Secrets tabs

## 7. Onboarding new users (if you share this repo)

Anyone cloning the repo follows the "Prerequisites" section of `README.md`. Core steps:

```bash
git clone https://github.com/<USERNAME>/cysic-auto-manager.git
cd cysic-auto-manager
npm install
cp .env.example .env
# Fill MAIN_WALLET_ADDRESS and BRIDGE_RECIPIENT_BNB_ADDRESS in .env
notepad .secrets/main.mnemonic        # your own main mnemonic
notepad .secrets/wallet-1.mnemonic    # your own sub mnemonic (as needed)
npm run doctor
npm run balance
```

## ⚠️ If you accidentally push a secret

**Immediately do the following:**

1. **Move all funds controlled by the leaked mnemonic to a new wallet.**
   - Once a mnemonic appears in a public repo, it is permanently compromised.
   - `git revert`, `git reset --hard`, and force-push are **all insufficient** — GitHub forks, caches, and mirrors may already have copies.

2. Make the repo private or delete it. This only removes some traces — assume the mnemonic itself is leaked forever.

3. Any other chain account derived from the same mnemonic is also at risk. Audit all uses (mainnet, testnet, anywhere).

4. You can request credential-leak removal from GitHub Support (https://docs.github.com/articles/removing-sensitive-data-from-a-repository). External mirrors are out of GitHub's control.

**Prevention is the only real defense.**

## 💡 Bonus: GitHub Actions for automatic safety checks

A `.github/workflows/safety-check.yml` workflow can run `npm run doctor` on every PR/push. Left as future work.
