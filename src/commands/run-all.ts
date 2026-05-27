import { cmdBalance } from "./balance";
import { cmdClaim } from "./claim";
import { cmdCollect } from "./collect";
import { cmdBridge } from "./bridge";
import { log } from "../utils/logger";
import { sleep } from "../utils/retry";

/**
 * 전체 플로우: 잔액확인 → 클레임 → 수집 → 브릿지
 * 단계 사이에 트랜잭션 확정을 기다리기 위한 짧은 대기 시간 포함.
 */
export async function cmdRunAll(bridgeAmount?: string): Promise<void> {
  log.section("RUN-ALL: balance → claim → collect → bridge");

  await cmdBalance();
  await sleep(2000);

  await cmdClaim();
  log.info("클레임 후 블록 확정 대기 (10초)...");
  await sleep(10000);

  await cmdCollect();
  log.info("수집 후 블록 확정 대기 (10초)...");
  await sleep(10000);

  if (bridgeAmount) {
    await cmdBridge(bridgeAmount);
  } else {
    log.warn("브릿지 금액이 지정되지 않아 브릿지 단계 스킵 (예: run-all 100)");
  }

  log.ok("RUN-ALL 완료");
}
