[English](README.en.md) | [한국어](README.md)

# Cysic Auto Manager

Cysic mainnet 다중 지갑 자동 관리 툴.
**스테이킹 보상 클레임 → 메인 지갑으로 수집 → BNB 체인으로 브릿지** 까지 한 번에 처리합니다.

여러 지갑에 분산 스테이킹된 CYS 의 보상을 매번 Keplr 로 직접 클레임/송금/브릿지 하던 작업을 명령어 몇 개로 대체합니다.

## 무엇을 하나

| 명령 | 동작 |
|---|---|
| `npm run balance` | 모든 지갑의 잔액과 미수령 보상 표시 |
| `npm run claim` | 모든 지갑의 스테이킹 보상을 한 번에 클레임 |
| `npm run collect` | 서브 지갑의 CYS 를 메인 지갑으로 모음 |
| `npm run bridge -- 5` | 메인 지갑에서 5 CYS 를 BNB Chain 으로 브릿지 |
| `npm run run-all -- 5` | 위 네 단계 순차 실행 |
| `npm run doctor` | 보안 자세 자가진단 |

## 작동 원리

Cysic 은 **Cosmos SDK 위에 Ethermint 를 얹은 dual-stack 체인** 입니다 (chain id `cysicmint_4399-1`, EVM chain id `4399`). Keplr 는 Cosmos 측 표준 `MsgWithdrawDelegatorReward` / `MsgSend` 트랜잭션을 보내고, 브릿지는 EVM 측 컨트랙트 `withdraw()` 를 호출합니다. 이 툴이 동일한 흐름을 자동화합니다.

기술 스택:
- **TypeScript + Node.js**
- **CosmJS** (`@cosmjs/stargate`, `@cosmjs/proto-signing`) — Cosmos 측 트랜잭션
- **ethers.js v6** — EVM 측 (브릿지 컨트랙트 호출)
- **자체 Ethermint signer** — Cysic 만의 pubkey 타입 `/cysicmint.crypto.v1.ethsecp256k1.PubKey` 와 Keccak256 서명을 지원

Cysic 은 표준 Ethermint 가 아니라 **고유 namespace** 를 쓰므로 일반 CosmJS / Evmos SDK 만으로는 트랜잭션이 거부됩니다. 이 툴은 그 차이를 흡수합니다.

## 사전 준비

### 1. 설치

```bash
git clone <this-repo>
cd cysic-auto-manager
npm install
```

요구사항: Node.js 18 이상.

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 를 열고 채울 값:

- **`MAIN_WALLET_ADDRESS`** — 본인의 메인 지갑 bech32 주소 (`cysic1...`)
- **`BRIDGE_RECIPIENT_BNB_ADDRESS`** — BNB 체인에서 CYS BEP-20 을 받을 본인의 `0x...` 주소
  (Keplr 의 Cysic 계정과 같은 키로 controlled 되는 EVM 주소를 쓰면 같은 mnemonic 으로 양쪽 접근 가능)
- 나머지는 기본값이면 됩니다.

### 3. 지갑 키 설정 (가장 중요)

**키는 `.env` 가 아니라 `.secrets/` 폴더에 한 지갑당 한 파일로 저장합니다.**
지갑마다 두 형식 중 **하나만** 선택해 사용할 수 있습니다:

| 형식 | 확장자 | 내용 |
|---|---|---|
| BIP-39 mnemonic | `.mnemonic` | 12 또는 24 단어 (한 줄) |
| Raw private key | `.privkey` | 64자 hex (한 줄, `0x` 접두사 선택) |

```bash
# .secrets/ 디렉토리는 .gitignore 로 보호됨

# 방식 A: mnemonic
notepad .secrets/main.mnemonic        # 메인 지갑
notepad .secrets/wallet-1.mnemonic    # 서브 지갑 1

# 방식 B: private key
notepad .secrets/main.privkey         # 메인 지갑
notepad .secrets/wallet-1.privkey     # 서브 지갑 1

# 지갑마다 mnemonic 과 privkey 둘 다 두면 모호하므로 에러.
```

각 파일 내용:
- `.mnemonic`: `word1 word2 word3 ... word12` (12 또는 24 단어)
- `.privkey`: `0x59a5...` (64자 hex, `0x` 선택)

두 형식 모두 **동일한 자산 통제권**을 부여합니다. 노출 시 위험 동일.

### 4. 첫 실행 검증

```bash
npm run doctor          # 보안 자세 점검 (모두 OK 인지)
npm run balance         # 지갑 자산이 정확히 보이는지
```

`balance` 가 본인이 Keplr 에서 보던 주소/금액과 일치하면 모든 연동이 정상입니다.

## 명령어 사용

```bash
npm run balance              # 전체 지갑 잔액 + 미수령 보상
npm run claim                # 전체 지갑 스테이킹 보상 클레임
npm run collect              # 메인 지갑으로 CYS 모으기
npm run bridge -- 5          # 5 CYS 를 BNB 로 브릿지
npm run run-all -- 5         # 위 전부 순차 실행
```

`npm` 의 `--` 다음 인자는 CLI 로 전달됩니다.

### 처음에는 DRY_RUN 으로 시뮬레이션

`.env` 의 `DRY_RUN=true` 상태로 모든 명령을 한 번씩 돌려서 로그가 합리적인지 확인 후, `DRY_RUN=false` 로 바꿔 실전 사용.

## 보안

이 툴은 **본인의 mnemonic 으로 트랜잭션을 서명** 합니다. 노출 시 자산을 영구적으로 잃을 수 있으니 다음 규칙을 지키세요.

### 자동으로 적용되는 보호장치

1. **`.secrets/` 분리** — mnemonic 은 `.env` 와 별도 디렉토리에 저장. 코드는 이 폴더만 읽음.
2. **`.gitignore` 다중 패턴** — `.env`, `.env.*`, `.secrets/`, `*.mnemonic`, `*.privkey`, `*.key`, `*.pem`, `keystore/`, `wallets.json` 모두 제외.
3. **Claude Code PreToolUse hook** (`.claude/hooks/block-secrets.ps1`) — AI 코딩 도구로 작업 시 비밀 파일 접근을 차단.
4. **런타임 마스킹** (`src/utils/secret-guard.ts`) — 실수로 `console.log(mnemonic)` 해도 자동 마스킹.
5. **CLAUDE.md** — AI 에이전트가 따라야 할 규칙 명시.

### 사용자가 지켜야 할 규칙

- **mnemonic 이나 private key 를 채팅창/이메일/메신저/AI 어시스턴트 등에 절대 붙여넣지 말 것.**
- **`.secrets/`, `.env` 폴더를 압축해서 클라우드/외부에 보내지 말 것.**
- **누가 만든 `.bak` 백업이라도 mnemonic 평문이 들어있으면 즉시 안전 삭제.**
- `npm run doctor` 를 자주 돌려서 보안 자세 확인.

### 외부 공격 노출 면

이 툴은 본인 PC 에서만 실행되며 외부 서비스에 mnemonic 을 보내지 않습니다.
RPC 통신은 모두 본인 → Cysic 공식 RPC 단방향이며 서명은 로컬에서 합니다.

다만 PC 자체가 침해되면 `.secrets/` 도 노출됩니다. 추가 보호를 원한다면:
- 별도의 보안 PC / 가상머신에서만 사용
- 메인 지갑에는 매번 모은 CYS 외에 큰 자산을 두지 말기
- 정기적으로 `npm run doctor` 로 백업 잔재 점검

## 폴더 구조

```
cysic-auto-manager/
├─ src/
│  ├─ index.ts                     # CLI 진입점 (commander)
│  ├─ config/
│  │  ├─ chains.ts                 # 체인 설정 (지연 로드)
│  │  └─ wallets.ts                # .secrets/ 에서 mnemonic 또는 privkey 로드
│  ├─ wallet/
│  │  ├─ cosmos.ts                 # ResolvedWallet 빌더
│  │  ├─ ethermint-signer.ts       # Cysic 호환 OfflineDirectSigner
│  │  └─ evm.ts                    # ethers Provider/Wallet 헬퍼
│  ├─ cosmos/
│  │  ├─ client.ts                 # Stargate 클라이언트
│  │  ├─ account.ts                # EthAccount 인식 account 조회
│  │  ├─ balance.ts                # 잔액/보상 조회
│  │  ├─ claim.ts                  # 스테이킹 보상 클레임
│  │  ├─ transfer.ts               # CYS 송금
│  │  └─ ethermint-tx.ts           # 수동 tx 빌드 + 서명 + broadcast
│  ├─ bridge/
│  │  └─ cysic-to-bnb.ts           # 브릿지 컨트랙트 호출
│  ├─ commands/                    # CLI 서브 명령
│  └─ utils/
│     ├─ logger.ts                 # 컬러 로그 + 파일 기록
│     ├─ retry.ts                  # 재시도
│     ├─ format.ts                 # 금액 단위 변환
│     └─ secret-guard.ts           # 런타임 mnemonic 마스킹
├─ scripts/
│  ├─ doctor.ts                    # 보안 자가진단
│  └─ migrate-to-secrets.ts        # 옛 .env 의 mnemonic 을 .secrets/ 로 이전
├─ .claude/
│  ├─ settings.local.json          # AI 코딩 도구 hook 등록
│  └─ hooks/
│     └─ block-secrets.ps1         # 비밀 파일 접근 차단 hook
├─ .secrets/                       # 키 저장소 (gitignored, README 제외)
│  └─ README.md                    # .mnemonic / .privkey 두 형식 사용법
├─ logs/                           # 일별 트랜잭션 로그 (gitignored)
├─ .env.example                    # 환경변수 템플릿 (공개)
├─ .env                            # 실제 환경변수 (gitignored)
├─ .gitignore
├─ CLAUDE.md                       # AI 에이전트 작업 규칙
├─ tsconfig.json
├─ package.json
├─ LICENSE
└─ README.md
```

## 검증된 정보 (2026-05 시점)

| 항목 | 값 |
|---|---|
| Cosmos chain id | `cysicmint_4399-1` |
| EVM chain id | `4399` |
| RPC (Cosmos) | `https://rpc.cysic.xyz` |
| LCD/REST | `https://rest.cysic.xyz` |
| EVM JSON-RPC | `https://rpc-evm.cysic.xyz` |
| Explorer (EVM) | `https://explorer-evm.cysic.xyz` |
| Bech32 prefix | `cysic` |
| Mint denom (보상) | `CYS` (18 decimals) |
| Stake denom | `CGT` |
| PubKey type URL | `/cysicmint.crypto.v1.ethsecp256k1.PubKey` |
| HD path | `m/44'/60'/0'/0/0` (Ethereum) |
| 주소 파생 | Keccak256 → 20 bytes → bech32 |
| 서명 해시 | Keccak256 (NOT SHA256) |
| Min gas price | 7 unit/gas (정수) |
| Unbonding | 21 일 |
| Bridge proxy (Cysic 측) | `0x127e8564bF37d179Bf6cC57a6209a3dacB6F9045` |
| Bridge fee (Cysic → BNB) | 약 2 CYS 고정 |
| CYS BEP-20 (BNB 측) | `0x0C69199C1562233640e0Db5Ce2c399A88eB507C7` |

## 알려진 한계

- **브릿지 fee 2 CYS 고정** — 소액 송금은 비효율적. 보상을 모아서 한 번에 보내는 게 합리적.
- **언본딩 21일** — CGT 위임 해제 후 21일 기다려야 CYS 로 회수.
- **`tokenCanOperation` view 함수의 의미 미확정** — 사전 점검에서 제외됨 (`estimateGas` 성공이 사실상 사전 검증).
- **Cysic 공식 SDK 부재** — 신생 체인이라 라이브러리 미비. 이 툴이 직접 구현으로 우회.

## 컨트리뷰션

이슈/PR 환영합니다. mnemonic 같은 비밀이 코드/로그/예제에 들어가지 않도록 확인 후 보내주세요.

## 면책

이 툴은 개인 자동화용으로 제공되며, **자산 손실에 대한 책임을 지지 않습니다**.
사용 전 반드시:
1. `DRY_RUN=true` 로 시뮬레이션
2. 소액으로 실제 트랜잭션 검증
3. 본인 PC 환경에서 mnemonic 보안 확인

특히 **브릿지 컨트랙트 주소는 코드 작성 시점의 검증값**이며, 향후 변경될 수 있습니다. 큰 금액 송금 전 공식 채널 (https://app.cysic.xyz/bridge) 의 최신 주소와 비교 권장.

## 라이선스

MIT
