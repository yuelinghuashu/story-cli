import assert from "node:assert"
import { type ChildProcess, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

const binPath = fileURLToPath(new URL("../bin/index.ts", import.meta.url))
const tempDirs: string[] = []
const childProcesses: ChildProcess[] = []

function setupRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watch-test-"))
  tempDirs.push(dir)
  // 创建有效故事
  const storyDir = path.join(dir, "01-测试故事")
  fs.mkdirSync(storyDir, { recursive: true })
  fs.writeFileSync(
    path.join(storyDir, "config.json"),
    JSON.stringify({
      title: "测试故事",
      type: "original",
      status: "ongoing",
      summary: "测试故事。",
      created: "2026-08-16",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(storyDir, "text.md"), "# 第一章\n\n这是正文内容。", "utf-8")
  return dir
}

after(() => {
  // 清理所有子进程
  for (const child of childProcesses) {
    try {
      child.kill("SIGTERM")
    } catch {
      // ignore
    }
  }
  // 清理临时目录
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** watch 子进程句柄：捕获 stdout+stderr，提供轮询式等待（替代固定 sleep，降低抖动） */
interface WatchHandle {
  child: ChildProcess
  output: () => string
  /** 等待输出中出现指定子串（轮询，超时抛错） */
  waitForOutput(substr: string, timeoutMs?: number): Promise<void>
  /** 等待输出中指定子串出现次数达到 minCount（用于区分新旧输出） */
  waitForOutputCount(substr: string, minCount: number, timeoutMs?: number): Promise<void>
  /** 等待文件存在 */
  waitForFile(filePath: string, timeoutMs?: number): Promise<void>
  /** 等待文件内容包含指定子串 */
  waitForFileContent(filePath: string, substr: string, timeoutMs?: number): Promise<void>
  /** 等待文件 mtime 晚于 baseMtime */
  waitForMtimeChange(filePath: string, baseMtime: number, timeoutMs?: number): Promise<void>
  /** 等待「指定子串计数」稳定（quietMs 内不再变化）后返回当前计数；无法稳定时超时抛错 */
  waitForSettledCount(substr: string, quietMs?: number, timeoutMs?: number): Promise<number>
  count(substr: string): number
  stop(): void
}

function startWatch(dir: string): WatchHandle {
  const child = spawn(process.execPath, [binPath, "build", "--watch"], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
  })
  childProcesses.push(child)

  let output = ""
  child.stdout.on("data", (d: Buffer) => {
    output += d.toString()
  })
  // 错误输出（console.error → stderr）也计入，便于断言构建失败场景
  child.stderr.on("data", (d: Buffer) => {
    output += d.toString()
  })

  const poll = async (predicate: () => boolean, what: string, timeoutMs: number): Promise<void> => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return
      await sleep(50)
    }
    throw new Error(`等待超时（${timeoutMs}ms）: ${what}\n--- 当前输出 ---\n${output}`)
  }

  const handle: WatchHandle = {
    child,
    output: () => output,
    waitForOutput: (substr, timeoutMs = 10_000) =>
      poll(() => output.includes(substr), `输出中出现 "${substr}"`, timeoutMs),
    waitForOutputCount: (substr, minCount, timeoutMs = 10_000) =>
      poll(() => handle.count(substr) >= minCount, `输出中 "${substr}" 出现 >= ${minCount} 次`, timeoutMs),
    waitForFile: (filePath, timeoutMs = 10_000) =>
      poll(() => fs.existsSync(filePath), `文件出现: ${filePath}`, timeoutMs),
    waitForFileContent: (filePath, substr, timeoutMs = 10_000) =>
      poll(
        () => {
          try {
            return fs.readFileSync(filePath, "utf-8").includes(substr)
          } catch {
            return false
          }
        },
        `文件内容包含 "${substr}": ${filePath}`,
        timeoutMs,
      ),
    waitForMtimeChange: (filePath, baseMtime, timeoutMs = 10_000) =>
      poll(
        () => {
          try {
            return fs.statSync(filePath).mtimeMs > baseMtime + 1
          } catch {
            return false
          }
        },
        `文件 mtime 变化: ${filePath}`,
        timeoutMs,
      ),
    waitForSettledCount: (substr, quietMs = 1000, timeoutMs = 15_000) =>
      new Promise((resolve, reject) => {
        const start = Date.now()
        let last = -1
        let lastChange = Date.now()
        const tick = () => {
          const c = handle.count(substr)
          if (c !== last) {
            last = c
            lastChange = Date.now()
          } else if (Date.now() - lastChange >= quietMs) {
            resolve(last)
            return
          }
          if (Date.now() - start > timeoutMs) {
            reject(
              new Error(`等待稳定超时（${timeoutMs}ms），计数持续增长（疑似自触发循环）\n--- 当前输出 ---\n${output}`),
            )
            return
          }
          setTimeout(tick, 100)
        }
        tick()
      }),
    count: (substr) => output.split(substr).length - 1,
    stop: () => {
      try {
        child.kill("SIGTERM")
      } catch {
        // ignore
      }
    },
  }
  return handle
}

test("build --watch 进程存活且文件变更触发重建", async () => {
  const dir = setupRepo()
  const h = startWatch(dir)

  // 等待初始构建完成
  await h.waitForOutput("重建完成")

  // 关键断言：进程应该仍然存活（之前被 process.exit() 杀死，这里是回归测试的核心）
  assert.strictEqual(h.child.exitCode, null, `build --watch 进程应保持存活，实际 exitCode=${h.child.exitCode}`)

  // 验证初始构建已发生
  assert.ok(h.output().includes("initial"), "应包含初始构建标记")
  assert.ok(fs.existsSync(path.join(dir, "README.md")), "根 README 应已生成")
  assert.ok(fs.existsSync(path.join(dir, "01-测试故事", "README.md")), "故事 README 应已生成")

  // 等待初始重建链完全稳定（README 自写入可能带来一次额外重建）
  await h.waitForSettledCount("检测到变更", 1000)

  // 修改故事，验证触发增量重建
  fs.writeFileSync(path.join(dir, "01-测试故事", "text.md"), "# 第一章 更新\n\n增量重建测试。")

  // 轮询等待 README 内容更新（比 mtime 断言更可靠）
  const storyReadme = path.join(dir, "01-测试故事", "README.md")
  await h.waitForFileContent(storyReadme, "第一章 更新")

  // 重建完成后进程仍然存活
  assert.strictEqual(h.child.exitCode, null, "重建完成后进程应仍然存活")
  h.stop()
})

test("watch 模式稳定：README 生成不触发自身重建循环（回归）", async () => {
  const dir = setupRepo()
  const h = startWatch(dir)

  // 等待初始构建完成并完全稳定（若有自触发循环，waitForSettledCount 会超时失败）
  const countAfterSettle = await h.waitForSettledCount("检测到变更", 1500)

  // 持续观察 2.5 秒：重建计数不应再增长
  await sleep(2500)
  assert.strictEqual(
    h.count("检测到变更"),
    countAfterSettle,
    "README 写入不应触发自身重建循环（修复前此处计数会持续增长）",
  )
  assert.strictEqual(h.child.exitCode, null, "进程应保持存活")
  h.stop()
})

test("watch 模式：新增故事目录后其内部变更触发重建", async () => {
  const dir = setupRepo()
  const h = startWatch(dir)

  await h.waitForOutput("重建完成")
  await h.waitForSettledCount("检测到变更", 1000)

  // 新增故事目录（config.json + text.md）
  const newDir = path.join(dir, "02-新故事")
  fs.mkdirSync(newDir)
  fs.writeFileSync(
    path.join(newDir, "config.json"),
    JSON.stringify({
      title: "新故事",
      type: "original",
      status: "ongoing",
      summary: "新故事。",
      created: "2026-08-16",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(newDir, "text.md"), "# 第一章\n\n新故事正文。", "utf-8")

  // 等待新故事的 README 被生成（说明新目录已被监听）
  const newReadme = path.join(newDir, "README.md")
  await h.waitForFile(newReadme)
  const mtime0 = fs.statSync(newReadme).mtimeMs

  // 修改新故事正文 → 应触发重建并更新其 README
  fs.writeFileSync(path.join(newDir, "text.md"), "# 第一章 更新\n\n新故事正文更新。")
  await h.waitForMtimeChange(newReadme, mtime0)
  assert.ok(fs.readFileSync(newReadme, "utf-8").includes("第一章 更新"), "新故事 README 应包含更新后的章节标题")
  h.stop()
})

test("watch 模式：配置损坏时进程存活并报错，修复后恢复重建", async () => {
  const dir = setupRepo()
  const h = startWatch(dir)

  await h.waitForOutput("重建完成")
  await h.waitForSettledCount("检测到变更", 1000)

  // 破坏 config.json（非法 JSON）
  fs.writeFileSync(path.join(dir, "01-测试故事", "config.json"), "{broken json", "utf-8")

  // 应输出构建失败错误，但进程保持存活
  await h.waitForOutput("构建失败")
  assert.strictEqual(h.child.exitCode, null, "构建失败时进程应保持存活")

  // 修复配置 → 应恢复重建并更新 README
  fs.writeFileSync(
    path.join(dir, "01-测试故事", "config.json"),
    JSON.stringify({
      title: "测试故事",
      type: "original",
      status: "ongoing",
      summary: "修复后的简介。",
      created: "2026-08-16",
    }),
    "utf-8",
  )
  await h.waitForFileContent(path.join(dir, "01-测试故事", "README.md"), "修复后的简介")
  assert.strictEqual(h.child.exitCode, null, "恢复后进程应仍然存活")
  h.stop()
})

test("watch 模式：.storyignore 变更触发重建", async () => {
  const dir = setupRepo()
  const h = startWatch(dir)

  await h.waitForOutput("重建完成")
  await h.waitForSettledCount("检测到变更", 1000)

  // 写入 .storyignore：它是仓库级配置，变更应触发重建（修复前点文件被统一跳过）
  fs.writeFileSync(path.join(dir, ".storyignore"), "# 忽略草稿\n03-被忽略的草稿/\n", "utf-8")
  await h.waitForOutput("（.storyignore）")

  // 新建一个被 .storyignore 规则覆盖的故事目录
  const ignoredDir = path.join(dir, "03-被忽略的草稿")
  fs.mkdirSync(ignoredDir)
  fs.writeFileSync(
    path.join(ignoredDir, "config.json"),
    JSON.stringify({
      title: "被忽略的草稿",
      type: "original",
      status: "ongoing",
      summary: "草稿。",
      created: "2026-08-16",
    }),
    "utf-8",
  )
  fs.writeFileSync(path.join(ignoredDir, "text.md"), "# 草稿正文\n\n内容。", "utf-8")

  // 目录创建会触发重建（根目录监听）
  await h.waitForOutput("（03-被忽略的草稿）")
  await h.waitForSettledCount("检测到变更", 1000)

  // .storyignore 规则应生效：被忽略的故事不出现在根 README
  const rootReadme = fs.readFileSync(path.join(dir, "README.md"), "utf-8")
  assert.ok(!rootReadme.includes("被忽略的草稿"), "被 .storyignore 忽略的故事不应出现在根 README")
  // 未忽略的故事仍正常出现
  assert.ok(rootReadme.includes("测试故事"), "未被忽略的故事应正常出现在根 README")
  h.stop()
})
