#!/usr/bin/env ts-node
/**
 * Migration: .env 에 평문으로 들어있는 mnemonic 들을
 *            .secrets/<label>.mnemonic 파일들로 분리해서 옮긴다.
 *
 * 이 스크립트는 **사용자 로컬에서만 실행**되며, mnemonic 내용을 stdout 으로
 * 절대 출력하지 않는다. 한 줄 한 줄 길이만 보고하고, 끝나면 .env 의 해당
 * 라인을 주석 처리한다.
 *
 * 실행:
 *   npx ts-node scripts/migrate-to-secrets.ts
 *
 * 멱등(idempotent): 이미 .secrets/<label>.mnemonic 이 있으면 덮어쓰지 않음.
 */
import { setupSecretGuard } from "../src/utils/secret-guard";
setupSecretGuard(); // 만의 하나라도 mnemonic 이 console 로 흘러도 마스킹

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const SECRETS_DIR = path.join(ROOT, ".secrets");

if (!fs.existsSync(ENV_PATH)) {
  console.error(".env 가 없습니다. 마이그레이션 대상이 없음.");
  process.exit(0);
}
if (!fs.existsSync(SECRETS_DIR)) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
}

// Windows 에서 파일 권한을 owner-only 로 잠그는 것은 ACL 작업이 필요해서
// 여기서는 폴더 분리 + .gitignore 로만 보호. icacls 안내는 doctor 가 함.

interface MnemonicEntry {
  envKey: string;
  fileName: string;
  rawLine: string;       // 원본 .env 라인 (주석 처리용)
  rawIndex: number;      // .env 의 줄 번호 (0-based)
  value: string;         // mnemonic 내용 (메모리에서만, 출력 금지)
}

const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
const targets: MnemonicEntry[] = [];

const PATTERN = /^(MAIN_WALLET_MNEMONIC|WALLET_\d+_MNEMONIC)\s*=\s*(.+)$/;

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(PATTERN);
  if (!m) continue;
  const envKey = m[1];
  const rawVal = m[2].trim();
  // 따옴표 제거
  const val = rawVal.replace(/^["']|["']$/g, "").trim();
  if (val.length === 0) continue;

  const fileName =
    envKey === "MAIN_WALLET_MNEMONIC"
      ? "main.mnemonic"
      : `wallet-${envKey.match(/WALLET_(\d+)_/)![1]}.mnemonic`;

  targets.push({
    envKey,
    fileName,
    rawLine: lines[i],
    rawIndex: i,
    value: val,
  });
}

if (targets.length === 0) {
  console.log("✅ .env 에 옮길 mnemonic 라인이 없습니다. 이미 정리된 상태.");
  process.exit(0);
}

console.log(`발견된 mnemonic 라인: ${targets.length} 개`);
let written = 0;
let skipped = 0;

for (const t of targets) {
  const filePath = path.join(SECRETS_DIR, t.fileName);
  if (fs.existsSync(filePath)) {
    console.log(`  - ${t.envKey.padEnd(25)} → .secrets/${t.fileName}  (이미 존재, 스킵)`);
    skipped++;
    continue;
  }
  fs.writeFileSync(filePath, t.value + "\n", { encoding: "utf8", mode: 0o600 });
  console.log(
    `  ✓ ${t.envKey.padEnd(25)} → .secrets/${t.fileName}  (${t.value.length} chars 저장)`
  );
  written++;
}

// .env 에서 해당 라인을 주석 처리
if (written > 0) {
  const newLines = [...lines];
  const ts = new Date().toISOString();
  for (const t of targets) {
    if (newLines[t.rawIndex].startsWith("#")) continue;
    newLines[t.rawIndex] =
      `# [moved to .secrets/${t.fileName} at ${ts}] ${t.envKey}=<redacted>`;
  }
  // 백업
  const backup = ENV_PATH + ".bak-" + ts.replace(/[:.]/g, "-");
  fs.copyFileSync(ENV_PATH, backup);
  fs.writeFileSync(ENV_PATH, newLines.join("\n"), "utf8");
  console.log(`\n✓ .env 의 mnemonic 라인 ${written}개 를 주석 처리 (백업: ${path.basename(backup)})`);
  console.log(`  ⚠️  백업 파일(.env.bak-*) 에도 평문 mnemonic 이 남아있습니다.`);
  console.log(`     확인 끝나면 백업도 삭제: del "${backup}"`);
}

console.log(`\n완료: 신규 ${written}개, 스킵 ${skipped}개`);
console.log(`다음 단계: npm run doctor  →  npm run balance`);
