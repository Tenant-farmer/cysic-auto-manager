#!/usr/bin/env ts-node
/**
 * 보안 자세 자가진단.
 * 비밀값을 절대 stdout 으로 출력하지 않음. OK / WARN / FAIL 만 보고.
 *
 * 실행: npm run doctor
 */
import { setupSecretGuard } from "../src/utils/secret-guard";
setupSecretGuard();

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const checks: { name: string; status: "OK" | "WARN" | "FAIL"; detail: string }[] = [];

function add(name: string, status: "OK" | "WARN" | "FAIL", detail: string) {
  checks.push({ name, status, detail });
}

// 1. .gitignore 가 비밀 패턴들을 가지고 있는가
{
  const giPath = path.join(ROOT, ".gitignore");
  if (!fs.existsSync(giPath)) {
    add(".gitignore", "FAIL", ".gitignore 파일 없음 — git 사용 시 위험");
  } else {
    const gi = fs.readFileSync(giPath, "utf8");
    const required = [".env", ".secrets/", "*.mnemonic", "*.key", "*.pem"];
    const missing = required.filter((p) => !gi.includes(p));
    if (missing.length > 0) add(".gitignore", "WARN", `누락된 패턴: ${missing.join(", ")}`);
    else add(".gitignore", "OK", "필요한 비밀 패턴 모두 등록됨");
  }
}

// 2. .git 폴더가 없는가 (실수 푸시 위험 차단)
{
  if (fs.existsSync(path.join(ROOT, ".git"))) {
    add(".git", "WARN", ".git 폴더 존재 — git push 시 .gitignore 에 의존");
  } else {
    add(".git", "OK", ".git 폴더 없음 (git 사용 안 함)");
  }
}

// 3. .env 에 mnemonic 평문 라인이 남아있는가
{
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    add(".env mnemonic 누출", "WARN", ".env 파일 없음");
  } else {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    const leaked: string[] = [];
    for (const line of lines) {
      const m = line.match(/^(MAIN_WALLET_MNEMONIC|WALLET_\d+_MNEMONIC)\s*=\s*(.+)$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, "").trim();
      if (val.length > 0) leaked.push(m[1]);
    }
    if (leaked.length > 0) {
      add(
        ".env mnemonic 누출",
        "FAIL",
        `.env 에 평문 mnemonic 있음: ${leaked.join(", ")}  → 'npm run migrate' 실행`
      );
    } else {
      add(".env mnemonic 누출", "OK", ".env 에 평문 mnemonic 없음");
    }
  }
}

// 4. .secrets/ 안에 mnemonic 파일들이 있는가
{
  const dir = path.join(ROOT, ".secrets");
  if (!fs.existsSync(dir)) {
    add(".secrets/", "FAIL", ".secrets/ 디렉토리 없음");
  } else {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".mnemonic"));
    if (files.length === 0) {
      add(".secrets/", "WARN", "mnemonic 파일이 없음 — 지갑 0개");
    } else {
      // 내용은 안 읽고 파일 크기/모드만 확인
      const details = files.map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return `${f}(${st.size}B)`;
      });
      add(".secrets/", "OK", `${files.length}개 mnemonic 파일: ${details.join(", ")}`);
    }
  }
}

// 5. .env 백업 파일 (mnemonic 평문이 남아있을 수 있음)
{
  const bakFiles = fs
    .readdirSync(ROOT)
    .filter((f) => /^\.env\.bak/.test(f));
  if (bakFiles.length > 0) {
    add(
      ".env 백업",
      "WARN",
      `백업 파일에 평문 mnemonic 잔존 가능: ${bakFiles.join(", ")} — 확인 후 삭제 권장`
    );
  } else {
    add(".env 백업", "OK", "백업 파일 없음");
  }
}

// 6. Claude hook 설치 여부
{
  const hook = path.join(ROOT, ".claude", "hooks", "block-secrets.ps1");
  const settings = path.join(ROOT, ".claude", "settings.local.json");
  if (!fs.existsSync(hook)) add("Claude hook 스크립트", "WARN", "block-secrets.ps1 없음");
  else add("Claude hook 스크립트", "OK", "block-secrets.ps1 존재");
  if (!fs.existsSync(settings)) add("Claude hook 등록", "WARN", "settings.local.json 없음");
  else {
    const s = fs.readFileSync(settings, "utf8");
    if (s.includes("block-secrets.ps1")) add("Claude hook 등록", "OK", "hook 참조 포함");
    else add("Claude hook 등록", "WARN", "settings 에 hook 참조 없음");
  }
}

// 7. CLAUDE.md 존재
{
  const claudeMd = path.join(ROOT, "CLAUDE.md");
  if (!fs.existsSync(claudeMd)) add("CLAUDE.md", "WARN", "프로젝트 규칙 파일 없음");
  else add("CLAUDE.md", "OK", "프로젝트 규칙 명시됨");
}

// 8. secret-guard runtime patch
{
  const guard = path.join(ROOT, "src", "utils", "secret-guard.ts");
  const index = path.join(ROOT, "src", "index.ts");
  if (!fs.existsSync(guard)) add("런타임 마스킹", "WARN", "secret-guard.ts 없음");
  else if (
    fs.existsSync(index) &&
    fs.readFileSync(index, "utf8").includes("setupSecretGuard")
  ) {
    add("런타임 마스킹", "OK", "index.ts 에서 setupSecretGuard() 호출");
  } else {
    add("런타임 마스킹", "WARN", "secret-guard 가 index.ts 에서 호출되지 않음");
  }
}

// 9. Git push 안전성 — staging 영역에 비밀 파일이 들어있나
{
  const gitDir = path.join(ROOT, ".git");
  if (!fs.existsSync(gitDir)) {
    add("git push 안전성", "OK", "git 미초기화 (push 위험 없음)");
  } else {
    try {
      // staged + unstaged 모두 확인
      const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
        .split(/\r?\n/)
        .filter((s) => s.length > 0);
      const dangerous = tracked.filter((f) => {
        // .env 정확히, 또는 .env.<bak/local/production/...> 단 .example/.sample/.template 은 제외
        if (/(^|\/)\.env$/.test(f)) return true;
        if (/(^|\/)\.env\.(?!example$|sample$|template$)/.test(f)) return true;
        // .secrets/ 안 파일들, 단 README.md 제외
        if (/(^|\/)\.secrets\/(?!README\.md$)/.test(f)) return true;
        // mnemonic / key / pem 확장자
        if (/\.(mnemonic|key|pem)$/.test(f)) return true;
        // keystore 디렉토리, wallets.json
        if (/(^|\/)keystore\//.test(f)) return true;
        if (/(^|\/)wallets\.json$/.test(f)) return true;
        return false;
      });
      if (dangerous.length > 0) {
        add(
          "git push 안전성",
          "FAIL",
          `git 이 비밀 파일을 추적 중: ${dangerous.slice(0, 5).join(", ")}${dangerous.length > 5 ? " ..." : ""}  → git rm --cached <file>`
        );
      } else {
        add("git push 안전성", "OK", `tracked 파일 ${tracked.length}개 중 비밀 파일 없음`);
      }
    } catch (e) {
      add("git push 안전성", "WARN", "git 명령 실행 실패");
    }
  }
}

// 10. README + LICENSE (공개 저장소 권장 항목)
{
  const readme = path.join(ROOT, "README.md");
  const license = path.join(ROOT, "LICENSE");
  if (!fs.existsSync(readme)) add("README.md", "WARN", "공개 저장소엔 README 권장");
  else add("README.md", "OK", "있음");
  if (!fs.existsSync(license)) add("LICENSE", "WARN", "공개 저장소엔 LICENSE 권장");
  else add("LICENSE", "OK", "있음");
}

// 출력
const symbol = { OK: "✓", WARN: "⚠", FAIL: "✗" } as const;
const col = { OK: "\x1b[32m", WARN: "\x1b[33m", FAIL: "\x1b[31m", reset: "\x1b[0m" } as const;

console.log("\n=== Cysic Auto Manager — Security Doctor ===\n");
for (const c of checks) {
  const colColor = c.status === "OK" ? col.OK : c.status === "WARN" ? col.WARN : col.FAIL;
  console.log(`  ${colColor}${symbol[c.status]} ${c.status.padEnd(4)}${col.reset} ${c.name.padEnd(28)} ${c.detail}`);
}

const fails = checks.filter((c) => c.status === "FAIL").length;
const warns = checks.filter((c) => c.status === "WARN").length;
console.log(`\n결과: ${checks.length - fails - warns} OK / ${warns} WARN / ${fails} FAIL\n`);

if (fails > 0) process.exit(1);
