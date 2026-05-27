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
 *   - 서명: Keccak256(signBytes) 를 secp256k1 으로 서명
 *
 * 주의: 이 signer 가 반환하는 AccountData.algo 는 "secp256k1" 이지만, 실제
 *      트랜잭션에서 pubkey 타입 URL 은 /cysicmint.crypto.v1.ethsecp256k1.PubKey
 *      이어야 합니다. ethermint-tx.ts 에서 별도로 처리.
 */
export class EthermintDirectSigner implements OfflineDirectSigner {
  private constructor(
    private readonly signingKey: ethers.SigningKey,
    public readonly bech32Address: string,
    public readonly evmAddress: string,
    public readonly compressedPubkey: Uint8Array
  ) {}

  /**
   * BIP-39 mnemonic (12/24 단어) 에서 signer 생성.
   * HD path 는 m/44'/60'/0'/0/0 (Ethereum 표준, Cysic 의 Keplr 가 사용).
   */
  static async fromMnemonic(
    mnemonic: string,
    prefix: string
  ): Promise<EthermintDirectSigner> {
    const hd = ethers.HDNodeWallet.fromPhrase(mnemonic);
    return EthermintDirectSigner.fromPrivateKeyInternal(hd.privateKey, hd.address, prefix);
  }

  /**
   * 64자 hex private key (0x 접두사 선택) 에서 signer 생성.
   * 단일 주소만 파생되며 mnemonic 의 HD path 와 무관.
   */
  static fromPrivateKey(
    privateKeyHex: string,
    prefix: string
  ): EthermintDirectSigner {
    const normalized = privateKeyHex.trim().startsWith("0x")
      ? privateKeyHex.trim()
      : "0x" + privateKeyHex.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
      throw new Error(
        "잘못된 private key 형식. 0x 접두사 선택, 64자 hex 가 필요합니다."
      );
    }
    const wallet = new ethers.Wallet(normalized);
    return EthermintDirectSigner.fromPrivateKeyInternal(normalized, wallet.address, prefix);
  }

  private static fromPrivateKeyInternal(
    privateKeyHex: string,
    evmAddress: string,
    prefix: string
  ): EthermintDirectSigner {
    const signingKey = new ethers.SigningKey(privateKeyHex);
    const ethAddrBytes = ethers.getBytes(evmAddress);
    const bech32 = toBech32(prefix, ethAddrBytes);
    const compressedHex = ethers.SigningKey.computePublicKey(signingKey.publicKey, true);
    const compressedPubkey = ethers.getBytes(compressedHex);
    return new EthermintDirectSigner(signingKey, bech32, evmAddress, compressedPubkey);
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
          type: "tendermint/PubKeySecp256k1",
          value: Buffer.from(this.compressedPubkey).toString("base64"),
        },
        signature: Buffer.from(signature64).toString("base64"),
      },
    };
  }
}
