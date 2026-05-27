import { getCysic } from "../config/chains";
import { WalletEntry } from "../config/wallets";
import { EthermintDirectSigner } from "./ethermint-signer";

export interface ResolvedWallet {
  label: string;
  isMain: boolean;
  address: string;       // bech32 (cysic1...)
  evmAddress: string;    // 0x...
  keyType: "mnemonic" | "privkey";
  signer: EthermintDirectSigner;
}

/**
 * Cysic (Ethermint) 용 지갑 생성.
 * Mnemonic 이면 HD path m/44'/60'/0'/0/0 으로 키 파생,
 * Privkey 이면 그 키를 직접 사용. 양쪽 모두 Keccak256 주소 파생.
 */
export async function resolveWallet(entry: WalletEntry): Promise<ResolvedWallet> {
  const prefix = getCysic().bech32Prefix;
  const signer =
    entry.keyType === "mnemonic"
      ? await EthermintDirectSigner.fromMnemonic(entry.keyMaterial, prefix)
      : EthermintDirectSigner.fromPrivateKey(entry.keyMaterial, prefix);

  return {
    label: entry.label,
    isMain: entry.isMain,
    address: signer.bech32Address,
    evmAddress: signer.evmAddress,
    keyType: entry.keyType,
    signer,
  };
}

export async function resolveAll(entries: WalletEntry[]): Promise<ResolvedWallet[]> {
  return Promise.all(entries.map(resolveWallet));
}
