# GitHub 에 안전하게 올리기

이 문서는 이 프로젝트를 **본인의 mnemonic / 개인 주소 노출 없이** GitHub 에 올리는 단계별 가이드입니다.

## 0. 사전 점검 (push 전에 반드시)

```bash
npm run doctor
```

**모두 OK 인지 확인**하고 진행. 특히:
- `.gitignore` 누락된 패턴 없음
- `.env` 에 평문 mnemonic 없음
- `.secrets/` 파일들 존재 (로컬에만)
- `.env 백업` 파일 없음

`FAIL` 이 있으면 push 금지. WARN 도 가급적 해결.

## 1. 로컬에서 git 초기화

```powershell
cd C:\Users\user\Desktop\cysic-auto-manager
git init
git branch -M main
```

## 2. 무엇이 commit 되는지 미리 확인

```powershell
git add .
git status                  # tracked 파일 목록 확인
```

**다음 파일들이 절대 목록에 없어야 합니다:**
- `.env`
- `.env.bak-*` 모든 백업 파일
- `.secrets/main.mnemonic`, `.secrets/wallet-*.mnemonic`
- 기타 `.mnemonic`, `.key`, `.pem`, `keystore/`, `wallets.json`

`.gitignore` 가 자동으로 막아주지만, **육안으로 한 번 더 확인**하세요.

확인용 명령:
```powershell
git ls-files | Select-String -Pattern "\.env|\.secrets|mnemonic|\.key|\.pem"
```
→ 한 줄도 안 나오면 안전. 한 줄이라도 나오면 abort.

## 3. doctor 한 번 더 (git 초기화 후)

```bash
npm run doctor
```

이번엔 `.git` 폴더가 있어서 doctor 가 추가로 "git push 안전성" 항목을 검사합니다. 여기서 staged 비밀 파일이 있으면 **FAIL** 로 표시됩니다. **FAIL 시 push 금지.**

## 4. 첫 commit

```powershell
git add .
git status                  # 다시 확인
git commit -m "Initial commit: Cysic Auto Manager"
```

## 5. GitHub 저장소 생성 후 push

GitHub.com 에서 **새 저장소 (빈 저장소, README/license 추가 X)** 생성 후:

```powershell
git remote add origin https://github.com/<USERNAME>/cysic-auto-manager.git
git push -u origin main
```

저장소를 **public** 으로 만들 거라면, push 직전 마지막 점검:

```powershell
# 비밀 패턴 grep — 결과 없어야 안전
git grep -i "mnemonic\|0x[a-f0-9]\{64\}"
```

12/24 단어 영어 문구도 한 번 더 살펴보세요.

## 6. push 후 검증

GitHub 웹에서 다음 항목 직접 확인:
- [ ] `.env` 파일이 저장소에 안 보임
- [ ] `.secrets/` 폴더에는 `README.md` 만 있고 `.mnemonic` 파일 없음
- [ ] `README.md` 와 `LICENSE` 표시됨
- [ ] Actions / Secrets 탭에 본인 환경변수 노출 없음

## 7. 다른 사람이 사용하려면 — 그들의 셋업 가이드

저장소 README 의 "사전 준비" 섹션을 따라 하면 됩니다. 핵심:
```bash
git clone https://github.com/<USERNAME>/cysic-auto-manager.git
cd cysic-auto-manager
npm install
cp .env.example .env
# .env 에 본인의 MAIN_WALLET_ADDRESS, BRIDGE_RECIPIENT_BNB_ADDRESS 채우기
notepad .secrets/main.mnemonic        # 본인의 메인 mnemonic
notepad .secrets/wallet-1.mnemonic    # 본인의 서브 mnemonic (필요한 만큼)
npm run doctor
npm run balance
```

## ⚠️ 만약 실수로 비밀을 push 했다면

**즉시 다음을 수행:**

1. **노출된 mnemonic 의 모든 자산을 즉시 새 지갑으로 이전.**
   - mnemonic 이 한 번이라도 public 저장소에 들어가면 영구히 위험.
   - `git revert`, `git reset --hard`, force push 모두 **불충분** — GitHub 의 fork, 캐시, 미러에 이미 복제됐을 수 있음.

2. 저장소를 private 으로 전환 or 삭제. 단, 이건 노출 흔적 일부만 지움 — mnemonic 자체는 이미 노출됐다고 간주.

3. 같은 mnemonic 으로 만든 다른 체인의 지갑도 모두 위험. 메인넷/테스트넷 가리지 않고 동일 키 사용처 모두 점검.

4. GitHub Support 에 "credential leak" 신고로 캐시 삭제 요청 가능 (https://docs.github.com/articles/removing-sensitive-data-from-a-repository) — 다만 외부 미러는 제어 불가.

**예방이 유일한 방어책**입니다.

## 💡 보너스: GitHub Actions 로 자동 검증

`.github/workflows/safety-check.yml` 같은 워크플로우로 PR/push 시 자동 doctor 실행 가능. 이건 향후 작업.
