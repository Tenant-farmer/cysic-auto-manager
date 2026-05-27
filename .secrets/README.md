# .secrets/

This directory stores wallet mnemonics — **one file per wallet, one mnemonic per file**.
이 디렉토리에는 지갑 니모닉이 **한 파일당 한 줄**로 저장됩니다.

---

## File naming / 파일 명명 규칙

- `main.mnemonic` — main wallet (where rewards are collected and bridging is initiated) / 메인 지갑 (보상이 모이고 브릿지를 보낼 지갑)
- `wallet-1.mnemonic` — sub-wallet 1 / 서브 지갑 1
- `wallet-2.mnemonic` — sub-wallet 2 / 서브 지갑 2
- … as many `wallet-N.mnemonic` as you need / 필요한 만큼 `wallet-N.mnemonic`

## File contents / 파일 내용

Each file holds only the 12 or 24 BIP-39 words on a single line:
각 파일에는 **mnemonic 12/24 단어만** 한 줄로:
```
word1 word2 word3 ... word12
```
- No quotes, comments, or blank lines. / 따옴표/주석/공백라인 없이.
- A trailing newline is fine — it's trimmed automatically. / 끝에 개행 한 줄 정도는 자동 trim 되므로 무방.

## How to create / 만드는 법

PowerShell:
```powershell
cd <project>\.secrets
notepad main.mnemonic           # Notepad opens, enter the words on one line, save
notepad wallet-1.mnemonic
```

Or with `Set-Content` for a one-liner:
```powershell
Set-Content -Path main.mnemonic -Value "word1 word2 ... word12" -NoNewline -Encoding utf8
```

## Security / 보안

- `.gitignore` excludes this entire directory except `README.md`.
  / `.gitignore` 가 이 디렉토리 전체를 제외함 (README.md 만 추적).
- `.claude/hooks/block-secrets.ps1` blocks AI tools from reading any file in this directory.
  / AI 도구가 이 디렉토리를 Read/Edit/Bash 로 접근하면 차단됨.
- No human, no AI, and no other process other than you should ever see the contents of these files.
  / 본인 외의 누구도, 어떤 AI 도, 이 파일들의 내용을 보지 못해야 정상.

## Relationship with `.env` / `.env` 와의 관계

The code reads mnemonics **only from this folder**. There is no environment-variable fallback — mnemonics in `.env` are ignored on purpose, to avoid the higher exposure risk of having them mixed with other config.
코드는 mnemonic 을 **이 폴더에서만** 읽습니다. 환경변수 폴백은 의도적으로 제거되었습니다 — `.env` 에 mnemonic 을 두는 것은 다른 설정과 섞여 노출 위험이 커서 지원하지 않습니다.
