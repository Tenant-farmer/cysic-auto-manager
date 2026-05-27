# .secrets/

This directory stores wallet keys — **one file per wallet**.
이 디렉토리에는 지갑 키가 **한 지갑당 한 파일**로 저장됩니다.

Two formats are supported per wallet — pick **one** (not both):
한 지갑당 두 형식 중 **하나만** 사용하세요 (동시 사용 금지):

| Format | Extension | Content |
|---|---|---|
| BIP-39 mnemonic | `.mnemonic` | 12 or 24 words on one line |
| Raw private key | `.privkey` | 64 hex chars on one line (0x prefix optional) |

---

## File naming / 파일 명명 규칙

- `main.mnemonic` **or** `main.privkey` — main wallet / 메인 지갑
- `wallet-1.mnemonic` **or** `wallet-1.privkey` — sub-wallet 1
- `wallet-2.mnemonic` **or** `wallet-2.privkey` — sub-wallet 2
- … as many `wallet-N` files as you need / 필요한 만큼 추가

⚠️ A single wallet must use only one form. If both `main.mnemonic` and `main.privkey`
   exist, the loader raises an error to prevent confusion.
   한 지갑에 두 형식이 동시에 있으면 에러로 거부됩니다.

## File contents / 파일 내용

### `.mnemonic`
```
word1 word2 word3 ... word12
```
- No quotes, comments, or blank lines. / 따옴표/주석/공백라인 없이.
- Trailing newline is fine. / 끝 개행은 자동 trim.

### `.privkey`
```
0x59a5b...64자hex
```
- The leading `0x` is optional. / `0x` 접두사는 있어도 되고 없어도 됨.
- Total 64 hex characters (32 bytes). / 정확히 64자 hex (32 바이트).
- One line only, no whitespace inside the key. / 한 줄, 키 내부에 공백 X.

## How to create / 만드는 법

PowerShell:
```powershell
cd <project>\.secrets

# Mnemonic
notepad main.mnemonic
# Or, private key
notepad main.privkey
```

One-liner with `Set-Content`:
```powershell
Set-Content -Path main.privkey -Value "0x59a5b...64자hex..." -NoNewline -Encoding utf8
```

## Mnemonic vs Private key — which to pick?

Both grant **identical control** over your wallet. Differences:

| Aspect | Mnemonic | Private key |
|---|---|---|
| Length / 길이 | 12–24 English words | 64 hex chars |
| Multiple addresses per key / 한 키 → 여러 주소 | ✅ HD derivation | ❌ single address |
| Visual identifiability / 시각적 구분 | Obvious from English words | Easily confused with tx hashes / addresses |
| Convenience for humans / 사람 친숙도 | Easier to read / write | Harder to type, easier to copy-paste |

**Security**: identical. Either, if leaked, results in total loss of funds.
**보안**: 동일. 어느 쪽이든 노출되면 자산 전부 위험.

## Security / 보안

- `.gitignore` excludes this entire directory except `README.md`.
  / `.gitignore` 가 이 디렉토리 전체를 제외함 (README.md 만 추적).
- `.claude/hooks/block-secrets.ps1` blocks AI tools from reading any file in this directory.
  / AI 도구가 이 디렉토리를 Read/Edit/Bash 로 접근하면 차단됨.
- No human, no AI, and no other process other than you should ever see the contents of these files.
  / 본인 외의 누구도, 어떤 AI 도, 이 파일들의 내용을 보지 못해야 정상.

## Relationship with `.env` / `.env` 와의 관계

The code reads keys **only from this folder**. There is no environment-variable fallback —
keys in `.env` are ignored on purpose to avoid the higher exposure risk of mixing them
with other config.
코드는 키를 **이 폴더에서만** 읽습니다. 환경변수 폴백은 의도적으로 제거되었습니다 —
`.env` 에 키를 두는 것은 다른 설정과 섞여 노출 위험이 커서 지원하지 않습니다.
