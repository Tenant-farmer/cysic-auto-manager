import { bridgeCysToBnb } from "../bridge/cysic-to-bnb";
import { loadWallets } from "../config/wallets";
import { log } from "../utils/logger";
import { runtime } from "../config/chains";

export async function cmdBridge(amountStr?: string): Promise<void> {
  log.section("Cysic → BNB 브릿지");

  // 메인 지갑의 mnemonic 을 wallets 로더에서 (환경변수 + .secrets/ 둘 다 처리)
  const wallets = loadWallets();
  const main = wallets.find((w) => w.isMain);
  if (!main) {
    throw new Error(
      "메인 지갑이 없습니다. .secrets/main.mnemonic 또는 MAIN_WALLET_MNEMONIC 을 설정하세요."
    );
  }

  const recipient = process.env.BRIDGE_RECIPIENT_BNB_ADDRESS?.trim();
  if (!recipient) {
    throw new Error("BRIDGE_RECIPIENT_BNB_ADDRESS 가 .env 에 설정되지 않았습니다.");
  }

  const amountHuman = amountStr ?? process.env.MIN_BRIDGE_AMOUNT;
  if (!amountHuman) {
    throw new Error("브릿지 금액을 지정하세요 (예: npm run bridge -- 100)");
  }
  if (Number(amountHuman) < runtime.minBridgeAmount) {
    throw new Error(
      `최소 브릿지 금액 ${runtime.minBridgeAmount} 미만입니다 (입력: ${amountHuman})`
    );
  }

  await bridgeCysToBnb({
    amountHuman,
    recipientBnb: recipient,
    mainMnemonic: main.mnemonic,
  });
}
