import { loadWallets, getMainAddressFromEnv } from "../config/wallets";
import { resolveAll } from "../wallet/cosmos";
import { sendToMain } from "../cosmos/transfer";
import { log } from "../utils/logger";
import { fromBaseUnit } from "../utils/format";

export async function cmdCollect(): Promise<void> {
  log.section("메인 지갑으로 CYS 수집");
  const mainAddress = getMainAddressFromEnv();
  log.info(`메인 지갑: ${mainAddress}`);

  const wallets = await resolveAll(loadWallets());
  let totalSent = 0n;

  for (const w of wallets) {
    try {
      const r = await sendToMain(w, mainAddress);
      if (!r.skipped) totalSent += BigInt(r.sent);
    } catch (e) {
      log.error(`[${w.label}] 전송 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log.ok(`총 수집 (요청 기준): ${fromBaseUnit(totalSent)} CYS`);
}
