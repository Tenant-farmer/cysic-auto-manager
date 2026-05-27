import { getCysic } from "../config/chains";

export interface AccountInfo {
  accountNumber: bigint;
  sequence: bigint;
}

/**
 * Ethermint EthAccount 를 인식해서 account_number / sequence 를 가져온다.
 * CosmJS 의 StargateClient.getAccount() 는 표준 BaseAccount 만 파싱하므로 사용 불가.
 */
export async function getEthermintAccount(address: string): Promise<AccountInfo> {
  const { rest } = getCysic();
  const url = `${rest}/cosmos/auth/v1beta1/accounts/${address}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`account 조회 실패 (${res.status}): ${address}`);
  }
  const data: any = await res.json();
  const acc = data.account ?? {};

  // EthAccount 는 base_account 안에 BaseAccount 가 들어있음
  const base = acc.base_account ?? acc;
  const accountNumber = BigInt(base.account_number ?? "0");
  const sequence = BigInt(base.sequence ?? "0");
  return { accountNumber, sequence };
}
