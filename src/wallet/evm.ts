import { ethers } from "ethers";
import { getCysic, getBnb } from "../config/chains";

export function cysicEvmProvider(): ethers.JsonRpcProvider {
  const c = getCysic();
  return new ethers.JsonRpcProvider(c.evm.rpc, c.evm.chainId);
}

export function bnbProvider(): ethers.JsonRpcProvider {
  const b = getBnb();
  return new ethers.JsonRpcProvider(b.rpc, b.chainId);
}

/**
 * 니모닉에서 EVM 지갑 생성 (브릿지 호출 시 사용).
 * Cysic 의 EVM 측은 동일한 키에서 파생된 다른 주소 (m/44'/60'/0'/0/0) 를 가질 수 있습니다.
 */
export function evmWalletFromMnemonic(
  mnemonic: string,
  provider: ethers.JsonRpcProvider
): ethers.Wallet {
  const hd = ethers.HDNodeWallet.fromPhrase(mnemonic);
  return new ethers.Wallet(hd.privateKey, provider);
}
