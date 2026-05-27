import { getCysic } from "../config/chains";

function defaultDecimals(): number {
  try {
    return getCysic().decimals;
  } catch {
    return 18; // .env 미설정 시 기본값 (포맷팅만 사용)
  }
}

/**
 * 사람 단위 (예: 1.23 CYS) → base unit string (예: "1230000000000000000")
 */
export function toBaseUnit(amount: number | string, decimals?: number): string {
  const d = decimals ?? defaultDecimals();
  const s = typeof amount === "number" ? amount.toString() : amount;
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(d)).slice(0, d);
  const joined = (whole + fracPadded).replace(/^0+/, "") || "0";
  return joined;
}

/**
 * base unit (예: "1230000000000000000") → 사람 단위 (예: "1.23")
 */
export function fromBaseUnit(amount: string | bigint, decimals?: number): string {
  const d = decimals ?? defaultDecimals();
  const s = typeof amount === "bigint" ? amount.toString() : amount;
  if (s === "0") return "0";
  const pad = s.padStart(d + 1, "0");
  const whole = pad.slice(0, pad.length - d);
  const frac = pad.slice(pad.length - d).replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : whole;
}

export function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}
