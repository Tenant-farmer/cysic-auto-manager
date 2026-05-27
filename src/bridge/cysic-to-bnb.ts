import { ethers } from "ethers";
import { cysicEvmProvider, evmWalletFromMnemonic } from "../wallet/evm";
import { log } from "../utils/logger";
import { shortAddr } from "../utils/format";
import { runtime, getBnb } from "../config/chains";
import { retry } from "../utils/retry";

/**
 * Cysic → BNB 브릿지 (실증된 ABI 사용)
 *
 * 검증 정보 (2026-05-27 시점, Cysic explorer + 실제 트랜잭션 디코드):
 *   - Bridge proxy:      0x127e8564bF37d179Bf6cC57a6209a3dacB6F9045  (ERC1967Proxy)
 *   - Implementation:    0x28C2Ef1E0e52d926A9305CB9660fb386a3a4A166  (MainBridge)
 *   - Function:          withdraw(address,uint256,uint256,address)  selector=0x16762eed
 *   - Native CYS token:  0x0000000000000000000000000000000000000001  (placeholder)
 *   - BNB chain id:      56
 *   - Native 송금 시:    msg.value == amount 필수
 *
 * 호출 흐름:
 *   1. user 가 메인 지갑(0x...) 에서 bridge proxy 의 withdraw() 호출
 *   2. event InitWithdraw 발생
 *   3. BLS multi-sig validators 가 BNB 측 SideBridge 에서 mint 처리
 *   4. recipient(BNB 0x 주소) 가 BEP-20 CYS 수령
 */

export const BRIDGE_PROXY_ADDRESS = "0x127e8564bF37d179Bf6cC57a6209a3dacB6F9045";
export const NATIVE_CYS_PLACEHOLDER = "0x0000000000000000000000000000000000000001";
export const BNB_CHAIN_ID_DECIMAL = 56;

const BRIDGE_ABI = [
  "function withdraw(address _token, uint256 _amount, uint256 _targetChainId, address _recipient) payable",
  "function paused() view returns (bool)",
  "function NATIVE_TOKEN() view returns (address)",
  "function cysicChainId() view returns (uint256)",
  "function tokenCanOperation(uint256 chainId, address token) view returns (bool)",
  "function tokenMapping(uint256 chainId, address sourceToken) view returns (address)",
  "function withdrawChainNonce(uint256 chainId) view returns (uint256)",
  "event InitWithdraw(address token, address from, uint256 amount, address recipient, uint256 targetChainId, address targetToken, uint256 nonce)",
];

export interface BridgeParams {
  /** 보낼 CYS 양 (사람 단위, 예: "100.5") */
  amountHuman: string;
  /** BNB 측 수신 0x 주소 */
  recipientBnb: string;
  /** 메인 지갑 니모닉 (브릿지 서명용) */
  mainMnemonic: string;
  /** 브릿지 컨트랙트 주소 override (기본 BRIDGE_PROXY_ADDRESS) */
  bridgeAddress?: string;
}

export async function bridgeCysToBnb(p: BridgeParams): Promise<{ txHash: string | null }> {
  if (!ethers.isAddress(p.recipientBnb)) {
    throw new Error(`잘못된 BNB 주소: ${p.recipientBnb}`);
  }

  const bridgeAddr = p.bridgeAddress ?? BRIDGE_PROXY_ADDRESS;
  const provider = cysicEvmProvider();
  const wallet = evmWalletFromMnemonic(p.mainMnemonic, provider);

  log.info(`Bridge 컨트랙트:  ${bridgeAddr}`);
  log.info(`송신 EVM 주소:    ${shortAddr(wallet.address)}`);
  log.info(`수신 BNB 주소:    ${shortAddr(p.recipientBnb)}`);

  const amount = ethers.parseUnits(p.amountHuman, 18);
  log.info(`금액:             ${p.amountHuman} CYS (${amount.toString()} wei)`);

  const contract = new ethers.Contract(bridgeAddr, BRIDGE_ABI, wallet);

  // ── 사전 점검 ──────────────────────────────────────────────────────────
  const paused: boolean = await contract.paused();
  if (paused) throw new Error("브릿지가 일시중지(paused) 상태입니다.");
  log.ok(`사전 점검 통과 (paused=false)`);
  // 참고: tokenCanOperation/tokenMapping 의 정확한 의미는 컨트랙트 소스 미공개로
  //      추측 불가. 실제 트랜잭션은 estimateGas 가 통과하면 거의 확실히 성공.

  // EVM 잔액 확인
  const balance = await provider.getBalance(wallet.address);
  if (balance < amount) {
    throw new Error(
      `잔액 부족: 보유 ${ethers.formatEther(balance)} CYS < 송금 ${p.amountHuman} CYS`
    );
  }

  // gas estimate
  const gasEstimate = await contract.withdraw.estimateGas(
    NATIVE_CYS_PLACEHOLDER,
    amount,
    BNB_CHAIN_ID_DECIMAL,
    p.recipientBnb,
    { value: amount }
  );
  log.info(`예상 gas:         ${gasEstimate.toString()}`);

  // 추가 안전: amount + 예상가스비 <= balance
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  const estFee = gasEstimate * gasPrice;
  if (balance < amount + estFee) {
    throw new Error(
      `가스비 포함 잔액 부족: 보유 ${ethers.formatEther(balance)} < ${ethers.formatEther(amount + estFee)} 필요`
    );
  }

  if (runtime.dryRun) {
    log.warn("DRY_RUN - 실제 브릿지 트랜잭션 생략");
    log.info(
      `호출 예정: withdraw(${NATIVE_CYS_PLACEHOLDER}, ${amount}, ${BNB_CHAIN_ID_DECIMAL}, ${p.recipientBnb})  value=${amount}`
    );
    return { txHash: null };
  }

  // ── 실제 전송 ──────────────────────────────────────────────────────────
  const tx = await retry(
    async () =>
      contract.withdraw(
        NATIVE_CYS_PLACEHOLDER,
        amount,
        BNB_CHAIN_ID_DECIMAL,
        p.recipientBnb,
        {
          value: amount,
          gasLimit: (gasEstimate * 120n) / 100n, // 20% 여유
        }
      ),
    { retries: 2, label: "bridge withdraw" }
  );

  log.info(`트랜잭션 전송: ${tx.hash}`);
  const receipt = await tx.wait();
  log.tx("bridge", receipt.hash);

  // InitWithdraw 이벤트 nonce 추출
  const iface = new ethers.Interface(BRIDGE_ABI);
  for (const lg of receipt.logs) {
    try {
      const parsed = iface.parseLog(lg);
      if (parsed?.name === "InitWithdraw") {
        log.ok(`✓ InitWithdraw event:  nonce=${parsed.args.nonce}`);
        log.ok(`  targetToken=${parsed.args.targetToken}`);
      }
    } catch {
      /* not our event */
    }
  }
  log.ok("브릿지 트랜잭션 확정. BNB 측 도착까지 수 분 ~ 수 십분 소요.");
  log.info(`bscscan 에서 수신 확인: https://bscscan.com/token/0x0c69199c1562233640e0db5ce2c399a88eb507c7?a=${p.recipientBnb}`);
  return { txHash: receipt.hash };
}
