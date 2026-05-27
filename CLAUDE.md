[English](CLAUDE.en.md) | [한국어](CLAUDE.md)

# 이 프로젝트에서 AI 에이전트가 따라야 할 규칙

이 프로젝트는 지갑 mnemonic 을 다룹니다. 부주의한 도구 호출 한 번으로 자산이 영구 손실될 수 있으니, AI 코딩 도구로 작업할 때 아래 규칙을 **반드시** 지킬 것.

## 📁 비밀 정보 저장 위치

- **`.env`** — 체인 설정(RPC URL, denom 등) + 메인 지갑 주소 + 동작 옵션. **키는 여기 없음.**
- **`.secrets/`** — 키 파일들 (`*.mnemonic` 또는 `*.privkey`) — **공개 저장소에는 절대 없음**
- 두 위치 모두 동일하게 비밀로 취급. 모든 형태의 dump 금지.

## 🛡️ 다층 방어 (설치되어 있음)

1. `.claude/hooks/block-secrets.ps1` — PreToolUse hook 이 `.env`, `.secrets/`, `*.mnemonic` 접근 시 exit 2
2. `.claude/settings.local.json` — 위 hook 등록
3. `.gitignore` — git 노출 차단
4. `src/utils/secret-guard.ts` — 런타임 console 에서 mnemonic 자동 마스킹

위 모두는 백업 안전망이며, **AI 본인의 판단이 1차 방어선**.

## 🚫 절대 금지 (어떤 사유로도)

1. **다음 파일을 `Read` / `Edit` / `Write` / `NotebookEdit` 도구로 절대 열지 말 것:**
   - `.env`, `.env.*`
   - `.secrets/*` (단, `.secrets/README.md` 는 공개 가능 — 검사 후 안전 확인된 것만)
   - `*.mnemonic`, `*.privkey`, `*.key`, `*.pem`
   - `keystore/`, `wallets.json`
   - 일반화: mnemonic / private key / seed phrase 를 담을 가능성이 있는 모든 파일

2. **다음 Bash 명령을 절대 실행하지 말 것:**
   - `cat .env`, `type .env`, `Get-Content .env`
   - `head .env`, `tail .env`, `less .env`, `more .env`
   - `.secrets/`, `*.mnemonic`, `*.key` 를 stdout 으로 출력하는 모든 명령

3. **출력 어디에서든 12/24 단어 BIP39 mnemonic 또는 64자 hex private key 형식 문자열이 발견되면 즉시 작업 중단하고 사용자에게 노출 사실을 알릴 것.**
   - ⚠️ 64자 hex 는 tx hash 와 시각적으로 구분이 어려움. 컨텍스트로 판단: `0x...` 가 `.secrets/`, `.privkey`, 키 입력 관련 코드 근처에 등장하면 private key 일 가능성. tx 출력 직후라면 hash. 의심스러우면 마스킹하고 사용자에게 확인.

4. **사용자가 채팅에 mnemonic / 0x-private-key 를 직접 붙여넣어도 절대 인용/요약/복사 형태로 출력하지 말 것.** 즉시 노출 사실 경고만.

## ✅ 비밀 파일을 다뤄야 할 때 — 안전한 방법

### `.env` 가 어떤 키를 가졌는지 / 비어있는지만 확인
```bash
awk -F= '/^[A-Z]/ && NF>1 {
  key=$1; val=substr($0, length(key)+2);
  if (val=="") status="(empty)";
  else if (key ~ /MNEMONIC|PRIVATE|KEY|SECRET|SEED/) status="(set, " length(val) " chars)";
  else status="= " val;
  printf "  %-35s %s\n", key, status
}' .env
```
→ 비밀값은 글자 수만 표시, 평범한 값(URL 등)만 평문 표시.

### `.env` 값을 수정해야 할 때
- 사용자가 알려준 정확한 `old_string` 으로 `Edit` 도구 사용.
- 정확한 매칭을 모르면 사용자에게 `notepad .env` 로 직접 수정 요청.
- **수정 후 결과 확인하려고 `Read` 하지 말 것.** Edit 가 성공했으면 그 자체로 충분.

### `.secrets/` 안의 키 파일을 다뤄야 할 때
- **그냥 만지지 말 것.** 사용자가 직접 `notepad .secrets/main.mnemonic` 또는 `.secrets/main.privkey` 로 편집.
- 파일 존재 여부만 알아야 하면 `ls .secrets/*.mnemonic`, `ls .secrets/*.privkey` 로 파일명만 확인.

## 🧠 비밀 처리의 일반 원칙

- **도구의 모든 출력은 채팅 로그에 영구 기록됨** — 한 번 출력하면 되돌릴 수 없음.
- **"필요할 것 같다"고 비밀 파일을 미리 읽지 말 것** — 정말 필요한 순간에 안전한 방법으로 최소한만.
- **사용자가 .env 내용을 채팅에 붙여넣으면**: 즉시 노출 사실 경고하고 새 지갑 생성 권유.

## 코드 작업 시 주의

- 디버깅 스크립트가 `.env` / `.secrets/` 를 읽어서 결과를 stdout 으로 출력하지 않게 할 것.
- 로그 파일(`logs/`) 에 mnemonic 이 들어가지 않도록 검토 후 작성.
- 새 의존성을 추가할 때 그 라이브러리가 자체 로깅으로 키를 노출하지 않는지 확인.
- 새 스크립트가 비밀을 다룬다면 진입점에서 `setupSecretGuard()` 호출.
