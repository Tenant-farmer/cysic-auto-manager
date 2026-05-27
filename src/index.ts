import { setupSecretGuard } from "./utils/secret-guard";
setupSecretGuard(); // 다른 import 전에 console 패치

import { Command } from "commander";
import { cmdBalance } from "./commands/balance";
import { cmdClaim } from "./commands/claim";
import { cmdCollect } from "./commands/collect";
import { cmdBridge } from "./commands/bridge";
import { cmdRunAll } from "./commands/run-all";
import { log } from "./utils/logger";

const program = new Command();

program
  .name("cysic-auto-manager")
  .description("Cysic 다중 지갑 자동 클레임 / 수집 / 브릿지 툴")
  .version("0.1.0");

program
  .command("balance")
  .description("모든 지갑의 CYS 잔액과 미수령 보상 표시")
  .action(async () => {
    try { await cmdBalance(); } catch (e) { fatal(e); }
  });

program
  .command("claim")
  .description("모든 지갑의 스테이킹 보상을 클레임")
  .action(async () => {
    try { await cmdClaim(); } catch (e) { fatal(e); }
  });

program
  .command("collect")
  .description("서브 지갑의 CYS 를 메인 지갑으로 모으기")
  .action(async () => {
    try { await cmdCollect(); } catch (e) { fatal(e); }
  });

program
  .command("bridge [amount]")
  .description("메인 지갑에서 BNB 체인으로 브릿지 (amount: CYS 단위)")
  .action(async (amount?: string) => {
    try { await cmdBridge(amount); } catch (e) { fatal(e); }
  });

program
  .command("run-all [bridgeAmount]")
  .description("balance → claim → collect → bridge 순차 실행")
  .action(async (bridgeAmount?: string) => {
    try { await cmdRunAll(bridgeAmount); } catch (e) { fatal(e); }
  });

function fatal(e: unknown) {
  log.error(e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
}

program.parseAsync(process.argv);
