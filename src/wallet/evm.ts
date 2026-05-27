import { ethers } from "ethers";
import { getCysic, getBnb } from "../config/chains";
import { WalletEntry } from "../config/wallets";

export function cysicEvmProvider(): ethers.JsonRpcProvider {
  const c = getCysic();
  return new ethers.JsonRpcProvider(c.evm.rpc, c.evm.chainId);
}

export function bnbProvider(): ethers.JsonRpcProvider {
  const b = getBnb();
  return new ethers.JsonRpcProvider(b.rpc, b.chainId);
}

/**
 * WalletEntry 에서 EVM 지갑 생성 (브릿지 호출 시 사용).
 * mnemonic 이면 HD path m/44'/60'/0'/0/0 의 첫 키,
 * privkey 이면 그 키를 직접 사용. 둘 다 동일한 0x 주소를 얻음.
 */
export function evmWalletFromEntry(
  entry: WalletEntry,
  provider: ethers.JsonRpcProvider
): ethers.Wallet {
  if (entry.keyType === "mnemonic") {
    const hd = ethers.HDNodeWallet.fromPhrase(entry.keyMaterial);
    return new ethers.Wallet(hd.privateKey, provider);
  }
  const normalized = entry.keyMaterial.trim().startsWith("0x")
    ? entry.keyMaterial.trim()
    : "0x" + entry.keyMaterial.trim();
  return new ethers.Wallet(normalized, provider);
}

/** @deprecated WalletEntry 를 받는 evmWalletFromEntry 를 쓰세요. */
export function evmWalletFromMnemonic(
  mnemonic: string,
  provider: ethers.JsonRpcProvider
): ethers.Wallet {
  const hd = ethers.HDNodeWallet.fromPhrase(mnemonic);
  return new ethers.Wallet(hd.privateKey, provider);
}
