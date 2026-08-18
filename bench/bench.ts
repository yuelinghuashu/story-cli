import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

/** 单次测量结果 */
interface BenchResult {
  marker: string
  ms: number
}

/** 阈值规格（marker 精确匹配测量行名） */
interface CheckSpec {
  marker: string
  limitMs: number
}

/**
 * 内置性能回归阈值（CI `--check` 用）
 * 取宽松绝对值（本机 100 玩具故事：cold ~200ms、epub ~250ms），
 * 主要防「灾难性回归」（如增量缓存失效导致每次全量重建、渲染路径爆炸变慢），
 * 避免 CI 机器抖动误报。阈值调整改这里即可。
 */
const DEFAULT_CHECK_SPECS: CheckSpec[] = [
  { marker: "build (full, cold)", limitMs: 3000 },
  { marker: "build (full, cached)", limitMs: 2000 },
  { marker: "export json", limitMs: 3000 },
  { marker: "export md", limitMs: 3000 },
  { marker: "epub --all", limitMs: 6000 },
]

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

function run(marker: string, cmd: string, cwd: string, results: BenchResult[]): void {
  const ms = time(() => {
    // 丢弃输出（bench 只测耗时；大仓库下捕获输出会撑爆 execSync 的 maxBuffer）
    execSync(cmd, { cwd, stdio: "ignore", encoding: "utf-8" })
  })
  console.log("  " + marker.padEnd(24) + ms.toFixed(1) + " ms")
  results.push({ marker, ms })
}

/**
 * 运行基准测量；可传入阈值规格做性能回归检查（CI 用）
 * @param repoDir 基准仓库目录
 * @param checkSpecs 阈值列表；任一实测耗时超阈值 → 打印 ❌ 并以退出码 1 结束
 */
export function runBenchmark(repoDir = ".", checkSpecs?: CheckSpec[]): void {
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
  const results: BenchResult[] = []
  run("build (validate only)", cli + " build --validate-only", dir, results)
  // 清掉 validate-only 生成的增量缓存，分别测量冷/热构建（热构建命中 .story-cache.json）
  try {
    fs.rmSync(path.join(dir, ".story-cache.json"))
  } catch {
    // 缓存文件不存在则跳过
  }
  run("build (full, cold)", cli + " build", dir, results)
  run("build (full, cached)", cli + " build", dir, results)
  run("export json", cli + " export json", dir, results)
  run("export md", cli + " export md", dir, results)
  run("epub --all", cli + " epub --all", dir, results)

  // 性能回归检查：实测超阈值即失败（CI 用，阈值取宽松绝对值避免机器抖动误报）
  if (checkSpecs && checkSpecs.length > 0) {
    console.log("----------------------------------------")
    let failed = false
    for (const spec of checkSpecs) {
      const result = results.find((r) => r.marker === spec.marker)
      if (!result) {
        console.error(`❌ bench check: unknown marker "${spec.marker}"`)
        failed = true
        continue
      }
      const ok = result.ms <= spec.limitMs
      console.log(`  ${ok ? "✅" : "❌"} ${spec.marker}: ${result.ms.toFixed(0)} ms (limit ${spec.limitMs} ms)`)
      if (!ok) failed = true
    }
    if (failed) {
      console.error("\n❌ Performance regression detected (thresholds exceeded).")
      process.exit(1)
    }
  }
  console.log("----------------------------------------")
}

// CLI 直接运行时解析参数：node bench/bench.ts <repoDir> [--check]
// --check：启用内置阈值做性能回归检查（CI 用；退出码 1 = 回归）
if (process.argv[1]?.endsWith("bench.ts")) {
  const args = process.argv.slice(2)
  const repoArg = args.find((a) => !a.startsWith("--")) ?? "."
  const checkSpecs = args.includes("--check") ? DEFAULT_CHECK_SPECS : undefined
  runBenchmark(repoArg, checkSpecs)
}
