import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { ResolvedWallet } from "../wallet/cosmos";
import { signAndBroadcastEthermint, makeFee } from "./ethermint-tx";
import { getBalance } from "./balance";
import { getCysic, runtime } from "../config/chains";
import { log } from "../utils/logger";
import { fromBaseUnit, toBaseUnit, shortAddr } from "../utils/format";
import { retry } from "../utils/retry";

/**
 * 한 지갑에서 메인 지갑으로 CYS 전송.
 * minKeepAmount 만큼 (수수료 + 안전 마진) 남기고 모두 전송.
 */
export async function sendToMain(
  w: ResolvedWallet,
  mainAddress: string
): Promise<{ txHash: string | null; sent: string; skipped: boolean }> {
  if (w.address === mainAddress) {
    log.info(`[${w.label}] 메인 지갑 본인 - 스킵`);
    return { txHash: null, sent: "0", skipped: true };
  }

  const bal = await getBalance(w.address);
  const balBig = BigInt(bal.raw);
  const keepBig = BigInt(toBaseUnit(runtime.minKeepAmount));
  const sendBig = balBig - keepBig;

  if (sendBig <= 0n) {
    log.info(
      `[${w.label}] 잔액 ${bal.human} CYS - 전송 가능 금액 없음 (최소보유 ${runtime.minKeepAmount})`
    );
    return { txHash: null, sent: "0", skipped: true };
  }

  const sendHuman = fromBaseUnit(sendBig);
  log.info(
    `[${w.label}] ${sendHuman} CYS → ${shortAddr(mainAddress)} (잔액 ${bal.human}, 보유유지 ${runtime.minKeepAmount})`
  );

  if (runtime.dryRun) {
    log.warn(`[${w.label}] DRY_RUN - 실제 전송 생략`);
    return { txHash: null, sent: sendBig.toString(), skipped: false };
  }

  const cy = getCysic();
  const message = {
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: MsgSend.fromPartial({
      fromAddress: w.address,
      toAddress: mainAddress,
      amount: [{ denom: cy.denom, amount: sendBig.toString() }],
    }),
  };

  const gpMatch = cy.gasPrice.match(/^([\d.]+)([A-Za-z]+)$/);
  if (!gpMatch) throw new Error(`gas price 형식 오류: ${cy.gasPrice}`);
  const fee = makeFee(BigInt(120_000), gpMatch[2], Number(gpMatch[1]));

  const result = await retry(
    async () =>
      signAndBroadcastEthermint({
        signer: w.signer,
        messages: [message],
        fee,
        memo: "collect-to-main",
      }),
    { retries: 2, label: `${w.label} transfer` }
  );

  if (result.code !== 0) {
    throw new Error(`Transfer 실패 (code ${result.code}): ${result.rawLog}`);
  }
  log.tx(`${w.label} → main`, result.transactionHash);
  return { txHash: result.transactionHash, sent: sendBig.toString(), skipped: false };
}
