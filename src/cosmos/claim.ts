import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { ResolvedWallet } from "../wallet/cosmos";
import { getPendingRewards } from "./balance";
import { signAndBroadcastEthermint, makeFee } from "./ethermint-tx";
import { log } from "../utils/logger";
import { shortAddr } from "../utils/format";
import { getCysic, runtime } from "../config/chains";
import { retry } from "../utils/retry";

/**
 * 한 지갑에서 위임된 모든 검증인의 보상을 한 번에 클레임.
 * 보상이 0 이면 스킵.
 */
export async function claimRewards(w: ResolvedWallet): Promise<{
  txHash: string | null;
  totalClaimed: string;
  skipped: boolean;
}> {
  const pending = await getPendingRewards(w.address);
  if (pending.validators.length === 0 || pending.total === "0") {
    log.info(`[${w.label}] 클레임할 보상 없음 (${shortAddr(w.address)})`);
    return { txHash: null, totalClaimed: "0", skipped: true };
  }

  log.info(
    `[${w.label}] 클레임 대상: ${pending.totalHuman} CYS (${pending.validators.length}개 검증인)`
  );

  if (runtime.dryRun) {
    log.warn(`[${w.label}] DRY_RUN - 실제 전송 생략`);
    return { txHash: null, totalClaimed: pending.total, skipped: false };
  }

  const messages = pending.validators.map((v) => ({
    typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
    value: MsgWithdrawDelegatorReward.fromPartial({
      delegatorAddress: w.address,
      validatorAddress: v.validator,
    }),
  }));

  const cy = getCysic();
  // gas estimate (보수적). 1 msg ~= 100k gas. validators 수 * 120k + 여유.
  const gasLimit = BigInt(120_000 * pending.validators.length + 80_000);
  // gas price 파싱 (예: "0.025CYS")
  const gpMatch = cy.gasPrice.match(/^([\d.]+)([A-Za-z]+)$/);
  if (!gpMatch) throw new Error(`gas price 형식 오류: ${cy.gasPrice}`);
  const gasPrice = Number(gpMatch[1]);
  const denom = gpMatch[2];
  const fee = makeFee(gasLimit, denom, gasPrice);

  const result = await retry(
    async () =>
      signAndBroadcastEthermint({
        signer: w.signer,
        messages,
        fee,
        memo: "auto-claim",
      }),
    { retries: 2, label: `${w.label} claim` }
  );

  if (result.code !== 0) {
    throw new Error(`Claim 실패 (code ${result.code}): ${result.rawLog}`);
  }
  log.tx(`${w.label} claim`, result.transactionHash);
  return { txHash: result.transactionHash, totalClaimed: pending.total, skipped: false };
}
