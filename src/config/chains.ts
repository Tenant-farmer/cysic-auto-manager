import * as dotenv from "dotenv";
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env: ${key}. .env 파일을 확인하세요.`);
  }
  return v;
}

export interface CosmosChain {
  chainId: string;
  rpc: string;
  rest: string;
  bech32Prefix: string;
  denom: string;          // 보상/전송 (CYS)
  stakingDenom: string;   // 스테이킹 (CGT) - 위임/언위임 시 사용
  decimals: number;
  gasPrice: string;
  evm: EvmChain;
}

export interface EvmChain {
  rpc: string;
  chainId: number;
}

interface Cached {
  cysic?: CosmosChain;
  bnb?: EvmChain;
}
const cache: Cached = {};

/**
 * 지연 평가: 실제 명령이 실행될 때만 .env 를 검증.
 * --help 같은 정보성 명령은 .env 없이도 동작.
 */
export function getCysic(): CosmosChain {
  if (cache.cysic) return cache.cysic;
  cache.cysic = {
    chainId: required("CYSIC_CHAIN_ID", "cysicmint_4399-1"),
    rpc: required("CYSIC_RPC_URL"),
    rest: required("CYSIC_REST_URL"),
    bech32Prefix: required("CYSIC_BECH32_PREFIX", "cysic"),
    denom: required("CYSIC_DENOM", "CYS"),
    stakingDenom: required("CYSIC_STAKING_DENOM", "CGT"),
    decimals: Number(required("CYSIC_DECIMALS", "18")),
    gasPrice: required("CYSIC_GAS_PRICE", "0.025CYS"),
    evm: {
      rpc: required("CYSIC_EVM_RPC_URL"),
      chainId: Number(required("CYSIC_EVM_CHAIN_ID", "4399")),
    },
  };
  return cache.cysic;
}

export function getBnb(): EvmChain {
  if (cache.bnb) return cache.bnb;
  cache.bnb = {
    rpc: required("BNB_RPC_URL", "https://bsc-dataseed.binance.org"),
    chainId: Number(required("BNB_CHAIN_ID", "56")),
  };
  return cache.bnb;
}

export const runtime = {
  get dryRun() {
    return (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
  },
  get minKeepAmount() {
    return Number(process.env.MIN_KEEP_AMOUNT ?? "0.01");
  },
  get minBridgeAmount() {
    return Number(process.env.MIN_BRIDGE_AMOUNT ?? "1");
  },
};
