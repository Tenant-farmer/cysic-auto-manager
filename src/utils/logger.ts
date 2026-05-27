import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

const logDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logDir, `${today}.log`);

function write(line: string) {
  fs.appendFileSync(logFile, line + "\n");
}

function ts(): string {
  return new Date().toISOString();
}

export const log = {
  info(msg: string) {
    const line = `[${ts()}] [INFO] ${msg}`;
    console.log(chalk.cyan(line));
    write(line);
  },
  ok(msg: string) {
    const line = `[${ts()}] [OK]   ${msg}`;
    console.log(chalk.green(line));
    write(line);
  },
  warn(msg: string) {
    const line = `[${ts()}] [WARN] ${msg}`;
    console.log(chalk.yellow(line));
    write(line);
  },
  error(msg: string) {
    const line = `[${ts()}] [ERR]  ${msg}`;
    console.error(chalk.red(line));
    write(line);
  },
  section(title: string) {
    const bar = "=".repeat(60);
    console.log(chalk.magenta(`\n${bar}\n  ${title}\n${bar}`));
    write(`\n${bar}\n  ${title}\n${bar}`);
  },
  tx(label: string, hash: string) {
    const line = `[${ts()}] [TX]   ${label}  hash=${hash}`;
    console.log(chalk.blue(line));
    write(line);
  },
};
