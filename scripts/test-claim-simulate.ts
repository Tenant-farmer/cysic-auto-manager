#!/usr/bin/env ts-node
/**
 * 클레임 트랜잭션을 simulate 만 해서 서명이 valid 한지 확인.
 * 실제 broadcast 는 안 함. 메인 지갑 한 개만 테스트.
 */
import { setupSecretGuard } from "../src/utils/secret-guard";
setupSecretGuard();

import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { loadWallets } from "../src/config/wallets";
import { resolveAll } from "../src/wallet/cosmos";
import { getPendingRewards } from "../src/cosmos/balance";
import { simulateEthermint, makeFee } from "../src/cosmos/ethermint-tx";
import { getCysic } from "../src/config/chains";

async function main() {
  const cy = getCysic();
  const wallets = await resolveAll(loadWallets());
  const main = wallets.find((w) => w.isMain);
  if (!main) throw new Error("메인 지갑이 없습니다.");

  console.log(`테스트 지갑: ${main.label}  ${main.address}`);

  const pending = await getPendingRewards(main.address);
  if (pending.validators.length === 0) {
    console.log("클레임할 보상 없음");
    return;
  }
  console.log(`보상: ${pending.totalHuman} CYS  (검증인 ${pending.validators.length}개)`);

  const messages = pending.validators.map((v) => ({
    typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
    value: MsgWithdrawDelegatorReward.fromPartial({
      delegatorAddress: main.address,
      validatorAddress: v.validator,
    }),
  }));

  const gpMatch = cy.gasPrice.match(/^([\d.]+)([A-Za-z]+)$/)!;
  const fee = makeFee(
    BigInt(120_000 * pending.validators.length + 80_000),
    gpMatch[2],
    Number(gpMatch[1])
  );

  console.log("\n--- Simulate 결과 ---");
  const sim = await simulateEthermint({
    signer: main.signer,
    messages,
    fee,
    memo: "test-simulate",
  });

  if (sim.ok) {
    console.log(`✅ Simulate 성공  (gas_used=${sim.gasUsed})`);
    console.log("→ 실제 broadcast 도 가능할 가능성 매우 높음");
  } else {
    console.log("❌ Simulate 실패");
    console.log(JSON.stringify(sim.rawResponse, null, 2));
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
