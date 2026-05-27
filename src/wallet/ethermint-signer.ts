import { ethers } from "ethers";
import { toBech32 } from "@cosmjs/encoding";
import {
  OfflineDirectSigner,
  AccountData,
  DirectSignResponse,
} from "@cosmjs/proto-signing";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

/**
 * Ethermint (Cysic 포함) 용 OfflineDirectSigner.
 *
 * 표준 CosmJS DirectSecp256k1HdWallet 와의 차이점:
 *   - HD path: m/44'/60'/0'/0/0 (Ethereum) — Keplr 가 Cysic 에 사용하는 path
 *   - 주소 파생: secp256k1 pubkey → Keccak256(uncompressed[1:]) 의 마지막 20바이트
 *                → bech32 (cysic prefix). Cosmos 표준의 SHA256+RIPEMD160 과 다름.
 *   - 서명: SHA256(signBytes) 를 secp256k1 으로 서명 (Cosmos direct 표준)
 *
 * 주의: 이 signer 가 반환하는 AccountData.algo 는 "secp256k1" 이지만, 실제
 *      트랜잭션에서 pubkey 타입 URL 은 /ethermint.crypto.v1.ethsecp256k1.PubKey
 *      이어야 합니다. SigningStargateClient 의 기본 signDirect 는 이를
 *      /cosmos.crypto.secp256k1.PubKey 로 하드코딩하므로, 트랜잭션 생성 시에는
 *      별도의 헬퍼(ethermint-tx.ts) 를 사용해 manual encoding 합니다.
 */
export class EthermintDirectSigner implements OfflineDirectSigner {
  private constructor(
    private readonly signingKey: ethers.SigningKey,
    public readonly bech32Address: string,
    public readonly evmAddress: string,
    public readonly compressedPubkey: Uint8Array
  ) {}

  static async fromMnemonic(
    mnemonic: string,
    prefix: string
  ): Promise<EthermintDirectSigner> {
    // ethers 기본 path = m/44'/60'/0'/0/0
    const hd = ethers.HDNodeWallet.fromPhrase(mnemonic);
    const signingKey = new ethers.SigningKey(hd.privateKey);

    // 0x address → 20 bytes → bech32 (cysic prefix)
    const ethAddrBytes = ethers.getBytes(hd.address);
    const bech32 = toBech32(prefix, ethAddrBytes);

    // Compressed secp256k1 pubkey (33 bytes)
    const compressedHex = ethers.SigningKey.computePublicKey(
      signingKey.publicKey,
      true
    );
    const compressedPubkey = ethers.getBytes(compressedHex);

    return new EthermintDirectSigner(
      signingKey,
      bech32,
      hd.address,
      compressedPubkey
    );
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return [
      {
        address: this.bech32Address,
        algo: "secp256k1",
        pubkey: this.compressedPubkey,
      },
    ];
  }

  /**
   * Ethermint ethsecp256k1 서명: Keccak256(SignDoc bytes) → secp256k1.
   * (표준 Cosmos direct 는 SHA256 을 쓰지만, Ethermint 체인의 verify 가
   * Keccak256 을 사용하므로 매칭시켜야 함.)
   * 64-byte signature (r||s) 반환.
   */
  async signDirect(
    signerAddress: string,
    signDoc: SignDoc
  ): Promise<DirectSignResponse> {
    if (signerAddress !== this.bech32Address) {
      throw new Error(
        `signerAddress 불일치: ${signerAddress} (expected ${this.bech32Address})`
      );
    }
    const signBytes = SignDoc.encode(signDoc).finish();
    const hash = ethers.getBytes(ethers.keccak256(signBytes));

    const sig = this.signingKey.sign(hash);
    const r = ethers.getBytes(sig.r);
    const s = ethers.getBytes(sig.s);
    const signature64 = new Uint8Array(64);
    signature64.set(r, 0);
    signature64.set(s, 32);

    return {
      signed: signDoc,
      signature: {
        pub_key: {
          type: "tendermint/PubKeySecp256k1", // amino 호환용 — broadcastTx 에서는 사용 안 됨
          value: Buffer.from(this.compressedPubkey).toString("base64"),
        },
        signature: Buffer.from(signature64).toString("base64"),
      },
    };
  }
}
