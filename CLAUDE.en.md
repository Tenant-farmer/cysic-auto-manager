[English](CLAUDE.en.md) | [한국어](CLAUDE.md)

# Rules AI agents must follow in this project

This project handles wallet mnemonics. A single careless tool call can permanently destroy funds. When working in this repository with an AI coding tool, follow these rules **without exception**.

## 📁 Where secrets live

- **`.env`** — Chain config (RPC URLs, denom, etc.), main wallet address, runtime options. **No keys here.**
- **`.secrets/`** — Key files (`*.mnemonic` or `*.privkey`). **Never present in the public repo.**
- Treat both locations as equally secret. Never dump their contents in any form.

## 🛡️ Defense in depth (already installed)

1. `.claude/hooks/block-secrets.ps1` — PreToolUse hook that exits with code 2 when `.env`, `.secrets/`, `*.mnemonic`, etc. are touched.
2. `.claude/settings.local.json` — registers the hook above.
3. `.gitignore` — keeps secrets out of git.
4. `src/utils/secret-guard.ts` — runtime console redaction of any mnemonic-shaped string.

These are backstops. **The AI's own judgment is the first line of defense.**

## 🚫 Absolutely forbidden (for any reason)

1. **Never open these files with `Read` / `Edit` / `Write` / `NotebookEdit`:**
   - `.env`, `.env.*`
   - `.secrets/*` (except `.secrets/README.md` after verifying it contains no secrets)
   - `*.mnemonic`, `*.privkey`, `*.key`, `*.pem`
   - `keystore/`, `wallets.json`
   - Generalize: any file that may contain a mnemonic, private key, or seed phrase.

2. **Never run these Bash commands:**
   - `cat .env`, `type .env`, `Get-Content .env`
   - `head .env`, `tail .env`, `less .env`, `more .env`
   - Any command that pipes `.secrets/`, `*.mnemonic`, or `*.key` to stdout.

3. **If any 12/24-word BIP-39 mnemonic OR 64-char hex private key appears in tool output, stop immediately and inform the user of the exposure.**
   - ⚠️ A bare 64-char hex string is visually indistinguishable from a tx hash. Use context: `0x...` near `.secrets/`, `.privkey`, or key-loading code is likely a key. Just after broadcasting a tx, it's a hash. When in doubt, redact and ask the user.

4. **If the user pastes a mnemonic or `0x` private key directly into chat, do not quote, summarize, or repeat it in any form.** Only warn about the exposure.

## ✅ Safe ways to inspect secret files

### Check which keys exist / which are empty in `.env`
```bash
awk -F= '/^[A-Z]/ && NF>1 {
  key=$1; val=substr($0, length(key)+2);
  if (val=="") status="(empty)";
  else if (key ~ /MNEMONIC|PRIVATE|KEY|SECRET|SEED/) status="(set, " length(val) " chars)";
  else status="= " val;
  printf "  %-35s %s\n", key, status
}' .env
```
→ Shows only key names and character counts for secrets; plaintext only for non-secrets like URLs.

### Modifying a value in `.env`
- Use `Edit` with the exact `old_string` the user provided.
- If you don't know the exact match, ask the user to edit with `notepad .env` directly.
- **Never `Read` the file to verify after editing.** If `Edit` succeeded, that's confirmation enough.

### Working with `.secrets/` key files
- **Just don't touch them.** Ask the user to edit via `notepad .secrets/main.mnemonic` or `.secrets/main.privkey`.
- If you only need to know whether files exist, use `ls .secrets/*.mnemonic` or `ls .secrets/*.privkey` to list names only.

## 🧠 General principles for handling secrets

- **Every tool output is logged in the conversation forever.** Once printed, it cannot be unwritten.
- **Never read a secret file "just in case."** Read the minimum, only when absolutely necessary, using a safe method.
- **If the user pastes `.env` contents into chat**, immediately warn about the exposure and recommend creating a new wallet.

## When writing code

- Make sure debug scripts that touch `.env` or `.secrets/` never print results to stdout.
- Audit log files (`logs/`) to ensure no mnemonic content leaks in.
- When adding a new dependency, verify it does not log keys through its own internal logging.
- New scripts that handle secrets should call `setupSecretGuard()` at their entry point.
