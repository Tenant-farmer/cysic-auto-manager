import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

export type KeyType = "mnemonic" | "privkey";

export interface WalletEntry {
  label: string;
  keyType: KeyType;
  keyMaterial: string; // mnemonic 문자열 또는 0x-private-key
  isMain: boolean;
}

const SECRETS_DIR = path.resolve(process.cwd(), ".secrets");

/**
 * 한 지갑(label)의 key 파일을 찾는다.
 *
 * 우선순위:
 *   - .secrets/<label>.mnemonic
 *   - .secrets/<label>.privkey
 *
 * 둘 다 존재하면 모호하므로 에러.
 * 둘 다 없으면 null.
 */
function readKeyForLabel(
  label: string
): { keyType: KeyType; keyMaterial: string } | null {
  const mnemFile = path.join(SECRETS_DIR, `${label}.mnemonic`);
  const pkFile = path.join(SECRETS_DIR, `${label}.privkey`);
  const mnemExists = fs.existsSync(mnemFile);
  const pkExists = fs.existsSync(pkFile);

  if (mnemExists && pkExists) {
    throw new Error(
      `${label} 에 .mnemonic 과 .privkey 가 모두 존재합니다. 하나만 두세요: ${SECRETS_DIR}`
    );
  }
  if (mnemExists) {
    const content = fs.readFileSync(mnemFile, "utf8").trim();
    if (content.length > 0) return { keyType: "mnemonic", keyMaterial: content };
  }
  if (pkExists) {
    const content = fs.readFileSync(pkFile, "utf8").trim();
    if (content.length > 0) return { keyType: "privkey", keyMaterial: content };
  }
  return null;
}

/**
 * 지갑 목록 로드.
 *
 * 디렉토리 구조 (양식 자유 — 한 지갑당 .mnemonic 또는 .privkey 둘 중 하나):
 *   .secrets/
 *     ├─ main.mnemonic              ─┐
 *     │   또는                       ├─ 메인 지갑
 *     ├─ main.privkey               ─┘
 *     ├─ wallet-1.mnemonic           ─┐
 *     │   또는                       ├─ 서브 지갑 1
 *     ├─ wallet-1.privkey           ─┘
 *     └─ ...
 *
 * Mnemonic: 12/24 단어, 공백 구분, 한 줄.
 * Privkey:  64자 hex (0x 접두사 선택 가능), 한 줄.
 */
export function loadWallets(): WalletEntry[] {
  const wallets: WalletEntry[] = [];

  // 서브 지갑 wallet-1 ~ 차례로 (빈 슬롯에서 중단)
  let i = 1;
  while (true) {
    const key = readKeyForLabel(`wallet-${i}`);
    if (!key) break;
    wallets.push({ label: `wallet-${i}`, isMain: false, ...key });
    i++;
  }

  // 메인 지갑
  const mainKey = readKeyForLabel("main");
  if (mainKey) {
    wallets.push({ label: "main", isMain: true, ...mainKey });
  }

  if (wallets.length === 0) {
    throw new Error(
      [
        "지갑이 하나도 없습니다.",
        "다음 위치에 키 파일을 만드세요 (.mnemonic 또는 .privkey 둘 중 하나):",
        `  ${path.join(SECRETS_DIR, "main.mnemonic")}      (메인 지갑 — mnemonic)`,
        `  ${path.join(SECRETS_DIR, "main.privkey")}        (메인 지갑 — private key)`,
        `  ${path.join(SECRETS_DIR, "wallet-1.mnemonic")}  (서브 지갑 1)`,
        "",
        "Mnemonic: 12/24 단어 한 줄.  Private key: 64자 hex 한 줄 (0x 선택).",
      ].join("\n")
    );
  }
  return wallets;
}

export function getMainAddressFromEnv(): string {
  const addr = process.env.MAIN_WALLET_ADDRESS?.trim();
  if (!addr) {
    throw new Error("MAIN_WALLET_ADDRESS 가 .env 에 설정되지 않았습니다.");
  }
  return addr;
}
