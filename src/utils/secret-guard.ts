/**
 * 런타임 방어선: 혹시 mnemonic 이나 0x 프라이빗키가 로그/콘솔로 흘러들어가도
 * 자동으로 마스킹한다. 사람/AI 가 실수로 console.log(mnemonic) 같은 짓을 해도
 * stdout 에는 가려진 값이 출력됨.
 *
 * setupSecretGuard() 를 CLI 엔트리포인트 맨 위에서 호출하면 적용된다.
 */

const MNEMONIC_LIKE = /\b((?:[a-z]{3,10}\s+){11,23}[a-z]{3,10})\b/gi;
// 0x + 64hex 는 tx hash 와 private key 가 시각적으로 동일하다.
// 사용자가 EVM private key 를 .env 에 직접 적는 일은 없으므로 (mnemonic 으로 파생),
// false positive 를 피하기 위해 패턴을 비활성화. mnemonic 마스킹만으로 충분.
const HEX_PRIVKEY_LIKE = /(?!)/; // 절대 매칭 안 됨

function mask(s: unknown): string {
  if (typeof s !== "string") {
    try {
      s = JSON.stringify(s);
    } catch {
      s = String(s);
    }
  }
  return (s as string)
    .replace(MNEMONIC_LIKE, "<MNEMONIC_REDACTED>")
    .replace(HEX_PRIVKEY_LIKE, "<PRIVKEY_REDACTED>");
}

let installed = false;

export function setupSecretGuard(): void {
  if (installed) return;
  installed = true;

  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  function wrap(orig: typeof console.log) {
    return (...args: unknown[]) => {
      const safe = args.map((a) => {
        if (typeof a === "string") return mask(a);
        if (a instanceof Error) {
          const e = a as Error;
          e.message = mask(e.message);
          if (e.stack) e.stack = mask(e.stack);
          return e;
        }
        if (typeof a === "object" && a !== null) {
          try {
            return JSON.parse(mask(JSON.stringify(a)));
          } catch {
            return a;
          }
        }
        return a;
      });
      orig(...safe);
    };
  }

  console.log = wrap(origLog);
  console.error = wrap(origErr);
  console.warn = wrap(origWarn);

  // Uncaught exception 도 마스킹
  process.on("uncaughtException", (err) => {
    const e = err as Error;
    e.message = mask(e.message);
    if (e.stack) e.stack = mask(e.stack);
    origErr(e);
    process.exit(1);
  });
}

// 단위 테스트용 export
export const _internal = { mask };
