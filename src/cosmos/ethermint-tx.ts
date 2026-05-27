import { Registry, EncodeObject } from "@cosmjs/proto-signing";
import { StargateClient, DeliverTxResponse, defaultRegistryTypes } from "@cosmjs/stargate";
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import {
  AuthInfo,
  Fee,
  SignDoc,
  SignerInfo,
  TxBody,
  TxRaw,
} from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { Any } from "cosmjs-types/google/protobuf/any";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

import { EthermintDirectSigner } from "../wallet/ethermint-signer";
import { getCysic } from "../config/chains";
import { getEthermintAccount } from "./account";

// Cysic 만의 namespace. 표준 ethermint 와 다름.
// 확인: REST /cosmos/auth/v1beta1/accounts/{addr} 의 pub_key @type 필드
const ETHSECP256K1_PUBKEY_URL = "/cysicmint.crypto.v1.ethsecp256k1.PubKey";

/**
 * Cysic(Ethermint) 용 수동 tx 빌더 + 서명 + 브로드캐스트.
 * CosmJS SigningStargateClient 가 pubkey 타입을 표준 cosmos secp256k1 로
 * 하드코딩하기 때문에, 직접 AuthInfo 를 구성해 ethsecp256k1 타입을 넣는다.
 */
export async function signAndBroadcastEthermint(opts: {
  signer: EthermintDirectSigner;
  messages: EncodeObject[];
  fee: { amount: Coin[]; gasLimit: bigint };
  memo: string;
  registry?: Registry;
}): Promise<DeliverTxResponse> {
  const { signer, messages, fee, memo } = opts;
  const cy = getCysic();
  const registry = opts.registry ?? new Registry(defaultRegistryTypes);

  // 1. account_number, sequence
  const { accountNumber, sequence } = await getEthermintAccount(signer.bech32Address);

  // 2. TxBody
  const txBody = TxBody.fromPartial({
    messages: messages.map((m) => ({
      typeUrl: m.typeUrl,
      value: registry.encode(m),
    })),
    memo,
  });
  const bodyBytes = TxBody.encode(txBody).finish();

  // 3. AuthInfo with ethsecp256k1 pubkey type
  const pubkeyAny = Any.fromPartial({
    typeUrl: ETHSECP256K1_PUBKEY_URL,
    value: PubKey.encode({ key: signer.compressedPubkey }).finish(),
  });
  const authInfo = AuthInfo.fromPartial({
    signerInfos: [
      SignerInfo.fromPartial({
        publicKey: pubkeyAny,
        modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
        sequence: sequence,
      }),
    ],
    fee: Fee.fromPartial({
      amount: fee.amount,
      gasLimit: fee.gasLimit,
    }),
  });
  const authInfoBytes = AuthInfo.encode(authInfo).finish();

  // 4. SignDoc → sign
  const signDoc = SignDoc.fromPartial({
    bodyBytes,
    authInfoBytes,
    chainId: cy.chainId,
    accountNumber,
  });
  const { signature } = await signer.signDirect(signer.bech32Address, signDoc);

  // 5. TxRaw + broadcast
  const txRaw = TxRaw.fromPartial({
    bodyBytes,
    authInfoBytes,
    signatures: [Buffer.from(signature.signature, "base64")],
  });
  const txBytes = TxRaw.encode(txRaw).finish();

  const client = await StargateClient.connect(cy.rpc);
  return client.broadcastTx(txBytes);
}

/**
 * 트랜잭션을 실제 broadcast 하지 않고 simulate endpoint 로 검증만 한다.
 * 서명/주소 mismatch 같은 에러를 broadcast 전에 확인 가능.
 */
export async function simulateEthermint(opts: {
  signer: EthermintDirectSigner;
  messages: EncodeObject[];
  fee: { amount: Coin[]; gasLimit: bigint };
  memo: string;
  registry?: Registry;
}): Promise<{ ok: boolean; gasUsed?: string; rawResponse: any }> {
  const { signer, messages, fee, memo } = opts;
  const cy = getCysic();
  const registry = opts.registry ?? new Registry(defaultRegistryTypes);

  const { accountNumber, sequence } = await getEthermintAccount(signer.bech32Address);

  const txBody = TxBody.fromPartial({
    messages: messages.map((m) => ({
      typeUrl: m.typeUrl,
      value: registry.encode(m),
    })),
    memo,
  });
  const bodyBytes = TxBody.encode(txBody).finish();

  const pubkeyAny = Any.fromPartial({
    typeUrl: ETHSECP256K1_PUBKEY_URL,
    value: PubKey.encode({ key: signer.compressedPubkey }).finish(),
  });
  const authInfo = AuthInfo.fromPartial({
    signerInfos: [
      SignerInfo.fromPartial({
        publicKey: pubkeyAny,
        modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
        sequence,
      }),
    ],
    fee: Fee.fromPartial({ amount: fee.amount, gasLimit: fee.gasLimit }),
  });
  const authInfoBytes = AuthInfo.encode(authInfo).finish();

  const signDoc = SignDoc.fromPartial({
    bodyBytes,
    authInfoBytes,
    chainId: cy.chainId,
    accountNumber,
  });
  const { signature } = await signer.signDirect(signer.bech32Address, signDoc);

  const txRaw = TxRaw.fromPartial({
    bodyBytes,
    authInfoBytes,
    signatures: [Buffer.from(signature.signature, "base64")],
  });
  const txBytes = TxRaw.encode(txRaw).finish();
  const txBase64 = Buffer.from(txBytes).toString("base64");

  const res = await fetch(`${cy.rest}/cosmos/tx/v1beta1/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_bytes: txBase64 }),
  });
  const data: any = await res.json();
  return {
    ok: res.ok && !data.code,
    gasUsed: data?.gas_info?.gas_used,
    rawResponse: data,
  };
}


/**
 * 간단 fee 빌더. 정확한 gas estimation 은 simulate 엔드포인트로 별도 구현 가능.
 */
export function makeFee(gasLimit: bigint, denom: string, gasPrice: number): {
  amount: Coin[];
  gasLimit: bigint;
} {
  // amount = ceil(gasLimit * gasPrice)
  const amount = BigInt(Math.ceil(Number(gasLimit) * gasPrice));
  return {
    amount: [{ denom, amount: amount.toString() }],
    gasLimit,
  };
}
