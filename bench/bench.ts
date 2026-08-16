import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

function time(fn: () => void): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}

function countStories(dir: string): number {
  try {
    return fs.readdirSync(dir).filter((n) => /^\d{2,}-.+/.test(n)).length
  } catch {
    return 0
  }
}

function run(marker: string, cmd: string, cwd: string): void {
  const ms = time(() => {
    execSync(cmd, { cwd, stdio: "pipe", encoding: "utf-8" })
  })
  console.log("  " + marker.padEnd(24) + ms.toFixed(1) + " ms")
}

export function runBenchmark(repoDir = "."): void {
  const dir = path.resolve(repoDir)
  const count = countStories(dir)
  if (count === 0) {
    console.error("No stories found. Run: node bench/generate.ts")
    process.exit(1)
  }
  console.log("\nBenchmark: " + count + " stories")
  console.log("----------------------------------------")
  // 动态解析项目根目录（不硬编码相对层级，支持 bench/ 被移动或项目结构变化）
  const projectRoot = path.resolve(import.meta.dirname, "..")
  const cli = `node ${path.join(projectRoot, "bin/index.ts")}`
  run("build (validate only)", cli + " build --validate-only", dir)
  run("build (full)", cli + " build", dir)
  run("export json", cli + " export json", dir)
  run("export md", cli + " export md", dir)
  run("epub --all", cli + " epub --all", dir)
  console.log("----------------------------------------")
}

if (process.argv[1]?.endsWith("bench.ts")) {
  runBenchmark(process.argv[2] ?? ".")
}