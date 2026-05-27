import { loadWallets } from "../config/wallets";
import { resolveAll } from "../wallet/cosmos";
import { getBalance, getPendingRewards } from "../cosmos/balance";
import { log } from "../utils/logger";
import { shortAddr } from "../utils/format";

export async function cmdBalance(): Promise<void> {
  log.section("지갑 잔액 / 미수령 보상");
  const wallets = await resolveAll(loadWallets());

  let totalBal = 0;
  let totalRew = 0;

  for (const w of wallets) {
    try {
      const bal = await getBalance(w.address);
      const rew = await getPendingRewards(w.address);
      const flag = w.isMain ? " [MAIN]" : "";
      console.log(
        `  ${w.label.padEnd(10)}${flag.padEnd(7)} ${shortAddr(w.address)}  잔액: ${bal.human.padStart(14)} CYS   보상: ${rew.totalHuman.padStart(14)} CYS`
      );
      totalBal += Number(bal.human);
      totalRew += Number(rew.totalHuman);
    } catch (e) {
      log.error(`${w.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log.ok(`합계  잔액: ${totalBal.toFixed(6)} CYS   미수령 보상: ${totalRew.toFixed(6)} CYS`);
}
