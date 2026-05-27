import { getReadClient } from "./client";
import { getCysic } from "../config/chains";
import { fromBaseUnit } from "../utils/format";

export interface BalanceInfo {
  address: string;
  raw: string;
  human: string;
}

export async function getBalance(address: string): Promise<BalanceInfo> {
  const client = await getReadClient();
  const cysic = getCysic();
  const coin = await client.getBalance(address, cysic.denom);
  return {
    address,
    raw: coin.amount,
    human: fromBaseUnit(coin.amount),
  };
}

/**
 * Cosmos SDK x/distribution 모듈에서 미수령(pending) 스테이킹 보상 조회.
 * REST API 의 distribution endpoint 를 사용합니다.
 */
export async function getPendingRewards(address: string): Promise<{
  total: string;
  totalHuman: string;
  validators: { validator: string; amount: string }[];
}> {
  const cysic = getCysic();
  const url = `${cysic.rest}/cosmos/distribution/v1beta1/delegators/${address}/rewards`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`보상 조회 실패: ${res.status} ${res.statusText}`);
  }
  const data: any = await res.json();

  const validators = (data.rewards ?? []).map((r: any) => {
    const reward = (r.reward ?? []).find((c: any) => c.denom === cysic.denom);
    return {
      validator: r.validator_address,
      amount: reward ? reward.amount.split(".")[0] : "0",
    };
  });

  const totalCoin = (data.total ?? []).find((c: any) => c.denom === cysic.denom);
  const total = totalCoin ? totalCoin.amount.split(".")[0] : "0";

  return {
    total,
    totalHuman: fromBaseUnit(total),
    validators,
  };
}
