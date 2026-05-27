import { loadWallets } from "../config/wallets";
import { resolveAll } from "../wallet/cosmos";
import { claimRewards } from "../cosmos/claim";
import { log } from "../utils/logger";
import { fromBaseUnit } from "../utils/format";

export async function cmdClaim(): Promise<void> {
  log.section("스테이킹 보상 클레임 (모든 지갑)");
  const wallets = await resolveAll(loadWallets());

  let totalClaimed = 0n;
  for (const w of wallets) {
    try {
      const r = await claimRewards(w);
      if (!r.skipped) totalClaimed += BigInt(r.totalClaimed || "0");
    } catch (e) {
      log.error(`[${w.label}] 클레임 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log.ok(`총 클레임 (요청 기준): ${fromBaseUnit(totalClaimed)} CYS`);
}
