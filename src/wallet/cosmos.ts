import { getCysic } from "../config/chains";
import { WalletEntry } from "../config/wallets";
import { EthermintDirectSigner } from "./ethermint-signer";

export interface ResolvedWallet {
  label: string;
  isMain: boolean;
  address: string;       // bech32 (cysic1...)
  evmAddress: string;    // 0x...
  signer: EthermintDirectSigner;
}

/**
 * Cysic (Ethermint) 용 지갑 생성.
 * - HD path: m/44'/60'/0'/0/0 (Ethereum)
 * - 주소 파생: Keccak256 → bech32 (cysic prefix)
 *
 * Keplr 가 Cysic 에 사용하는 방식과 동일합니다.
 */
export async function resolveWallet(entry: WalletEntry): Promise<ResolvedWallet> {
  const signer = await EthermintDirectSigner.fromMnemonic(
    entry.mnemonic,
    getCysic().bech32Prefix
  );
  return {
    label: entry.label,
    isMain: entry.isMain,
    address: signer.bech32Address,
    evmAddress: signer.evmAddress,
    signer,
  };
}

export async function resolveAll(entries: WalletEntry[]): Promise<ResolvedWallet[]> {
  return Promise.all(entries.map(resolveWallet));
}
