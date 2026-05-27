import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

export interface WalletEntry {
  label: string;
  mnemonic: string;
  isMain: boolean;
}

const SECRETS_DIR = path.resolve(process.cwd(), ".secrets");

/**
 * mnemonic 은 오직 .secrets/ 디렉토리에서만 읽는다.
 * 환경변수에 mnemonic 을 평문으로 두는 것은 노출 위험이 커서 의도적으로 지원하지 않는다.
 */
function readMnemonicFile(fileName: string): string | null {
  const filePath = path.join(SECRETS_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8").trim();
  return content.length > 0 ? content : null;
}

/**
 * 지갑 목록 로드.
 *
 * 디렉토리 구조:
 *   .secrets/
 *     ├─ main.mnemonic        # 메인 지갑 (보상이 모이고 브릿지를 보낼 지갑)
 *     ├─ wallet-1.mnemonic    # 서브 지갑 1
 *     ├─ wallet-2.mnemonic    # 서브 지갑 2
 *     └─ ...
 *
 * 파일은 mnemonic 12/24 단어를 한 줄로만 포함.
 */
export function loadWallets(): WalletEntry[] {
  const wallets: WalletEntry[] = [];

  // 서브 지갑 wallet-1.mnemonic ~ 차례로 (빈 슬롯에서 중단)
  let i = 1;
  while (true) {
    const m = readMnemonicFile(`wallet-${i}.mnemonic`);
    if (!m) break;
    wallets.push({ label: `wallet-${i}`, mnemonic: m, isMain: false });
    i++;
  }

  // 메인 지갑
  const mainM = readMnemonicFile("main.mnemonic");
  if (mainM) {
    wallets.push({ label: "main", mnemonic: mainM, isMain: true });
  }

  if (wallets.length === 0) {
    throw new Error(
      [
        "지갑이 하나도 없습니다.",
        "다음 위치에 mnemonic 파일을 만드세요:",
        `  ${path.join(SECRETS_DIR, "main.mnemonic")}      (메인 지갑)`,
        `  ${path.join(SECRETS_DIR, "wallet-1.mnemonic")}  (서브 지갑 1)`,
        `  ${path.join(SECRETS_DIR, "wallet-2.mnemonic")}  ... 필요한 만큼`,
        "",
        "각 파일에는 12/24 단어 mnemonic 만 한 줄로 저장하세요.",
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
