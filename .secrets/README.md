# .secrets/

이 디렉토리에는 지갑 니모닉이 **한 파일당 한 줄**로 저장됩니다.

## 파일 명명 규칙

- `main.mnemonic` — 메인 지갑 (보상이 모이고 브릿지를 보낼 지갑)
- `wallet-1.mnemonic` — 서브 지갑 1
- `wallet-2.mnemonic` — 서브 지갑 2
- ... 필요한 만큼 `wallet-N.mnemonic`

## 파일 내용

각 파일에는 **mnemonic 12/24 단어만** 한 줄로:
```
word1 word2 word3 ... word12
```
- 따옴표/주석/공백라인 없이.
- 끝에 개행 한 줄 정도는 자동 trim 되므로 무방.

## 만드는 법

PowerShell 에서:
```powershell
cd C:\Users\user\Desktop\cysic-auto-manager\.secrets
notepad main.mnemonic        # 노트패드 열려서 한 줄 입력 후 저장
notepad wallet-1.mnemonic
```

또는 (한 줄짜리라면) Set-Content 직접:
```powershell
Set-Content -Path main.mnemonic -Value "word1 word2 ... word12" -NoNewline -Encoding utf8
```

## 보안

- `.gitignore` 가 이 디렉토리 전체를 제외함
- `.claude/hooks/block-secrets.ps1` 가 Claude 가 이 디렉토리를 Read/Edit/Bash 로 접근하면 차단함 (다음 세션부터)
- 본인 외의 누구도, 어떤 AI 도, 이 파일들의 내용을 보지 못해야 정상

## .env 와의 관계

`.env` 의 `WALLET_N_MNEMONIC` 환경변수가 비어있으면 이 디렉토리에서 읽음.
환경변수에 값이 있으면 그게 우선 (하위호환). 가능하면 환경변수는 비워두고 파일만 사용 권장.
