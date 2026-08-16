import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

/** 测试入口脚本路径 */
export const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))

/** 创建临时目录 */
export function makeTemp(prefix = "cli-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/** CLI 运行结果 */
export interface CliResult {
  status: number
  output: string
  ok: boolean
}

/** 运行 CLI（支持 stdin 输入） */
export function runCli(args: string[], cwd: string, input?: string): CliResult {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf-8",
    input,
  })
  const output = `${result.stdout || ""}${result.stderr || ""}`
  return { status: result.status ?? -1, output, ok: result.status === 0 }
}

/** 清理指定前缀的临时目录 */
export function cleanupTempDirs(prefixes: string[]): void {
  try {
    const tmpDir = os.tmpdir()
    for (const entry of fs.readdirSync(tmpDir)) {
      const fullPath = path.join(tmpDir, entry)
      if (prefixes.some((p) => entry.startsWith(p)) && fs.statSync(fullPath).isDirectory()) {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true })
        } catch {
          // 忽略
        }
      }
    }
  } catch {
    // 忽略
  }
}
