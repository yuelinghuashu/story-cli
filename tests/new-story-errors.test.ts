import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { after, test } from "node:test"
import { cleanupTempDirs, makeTemp, runCli } from "./helpers.ts"

after(() => {
  cleanupTempDirs(["new-story-errors-"])
})

function initRepo(): string {
  const dir = makeTemp("new-story-errors-")
  const { ok, output } = runCli(["init"], dir)
  assert.ok(ok, `init 失败: ${output}`)
  return dir
}

// ─── story new 错误路径测试 ─────────────────────────────────

test("story new 无标题时提示用法并报错（中文）", () => {
  const dir = initRepo()
  const { ok, output } = runCli(["new"], dir)
  assert.ok(!ok, "无标题的 new 命令应返回非零退出码")
  assert.ok(output.includes("请指定故事标题"), `应提示标题缺失，实际输出: ${output}`)
  assert.ok(output.includes('story new "标题"'), "应提示用法")
})

test("story new 无标题时提示用法并报错（英文环境）", () => {
  const dir = initRepo()
  const { ok, output } = runCli(["new"], dir, undefined, { LANG: "en_US.UTF-8" })
  assert.ok(!ok, "无标题的 new 命令应返回非零退出码")
  assert.ok(output.includes("Please specify a story title!"), `英文环境应提示英文，实际输出: ${output}`)
  assert.ok(output.includes('story new "Title"'), "应提示英文用法")
})

test("story new 标题含特殊字符时净化创建（与 import json 行为一致）", () => {
  const dir = initRepo()
  const { ok, output } = runCli(["new", "非法/标题:测试"], dir)
  assert.ok(ok, `特殊字符标题应被净化创建（不再拒绝），实际输出: ${output}`)
  // `/` → `_`，`:` → `_`
  assert.ok(fs.existsSync(path.join(dir, "01-非法_标题_测试")), "净化后的目录应存在")
})

test("story new 标题只含空白字符时视为缺失并报错", () => {
  const dir = initRepo()
  const { ok, output } = runCli(["new", "   "], dir)
  assert.ok(!ok, "空白标题应视为缺失并报错")
  assert.ok(output.includes("请指定故事标题"), `应提示标题缺失，实际输出: ${output}`)
  // 不应留下孤儿目录（无 NN- 前缀的故事目录）
  const storyDirs = fs.readdirSync(dir).filter((f) => /^\d{2,}-/.test(f))
  assert.deepStrictEqual(storyDirs, [], "报错前不应创建任何故事目录")
})

test("story new --type=fanfic 缺少 --author 时报错", () => {
  const dir = initRepo()
  const { ok, output } = runCli(["new", "二创故事", "--type=fanfic"], dir)
  assert.ok(!ok, "缺少 --author 的 fanfic 应返回非零退出码")
  assert.ok(output.includes('--author="原作名"'), `应提示需要 --author，实际输出: ${output}`)
})

test("story new --type=fanfic 缺少 --creator 时报错", () => {
  const dir = initRepo()
  const { ok, output } = runCli(["new", "二创故事", "--type=fanfic", "--author=原作名"], dir)
  assert.ok(!ok, "缺少 --creator 的 fanfic 应返回非零退出码")
  assert.ok(output.includes('--creator="原作者"'), `应提示需要 --creator，实际输出: ${output}`)
})

test("story new --type=invalid 非法类型时报错", () => {
  const dir = initRepo()
  const { ok, output } = runCli(["new", "非法类型故事", "--type=invalid"], dir)
  assert.ok(!ok, "非法类型应返回非零退出码")
  assert.ok(output.includes('--type 必须是 "original" 或 "fanfic"'), `应列出合法类型，实际输出: ${output}`)
})

test("story new 使用仓库级自定义类型", () => {
  const dir = initRepo()
  fs.writeFileSync(
    path.join(dir, "story.config.json"),
    JSON.stringify({
      types: ["original", "fanfic", "translation"],
      statuses: ["completed", "ongoing", "planned"],
    }),
    "utf-8",
  )
  const { ok, output } = runCli(["new", "翻译故事", "--type=translation"], dir)
  assert.ok(ok, `自定义类型应创建成功: ${output}`)
  const storyDir = path.join(dir, "01-翻译故事")
  assert.ok(fs.existsSync(storyDir), "翻译故事目录应存在")
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as { type: string }
  assert.strictEqual(config.type, "translation")
})

test("story new 重复创建相同标题时分配递增序号", () => {
  const dir = initRepo()
  const { ok: firstOk } = runCli(["new", "重复故事"], dir)
  assert.ok(firstOk, "第一次创建应成功")
  const { ok: secondOk } = runCli(["new", "重复故事"], dir)
  assert.ok(secondOk, "第二次相同标题创建应成功并分配新序号")
  assert.ok(fs.existsSync(path.join(dir, "01-重复故事")), "第一个故事应为 01")
  assert.ok(fs.existsSync(path.join(dir, "02-重复故事")), "第二个故事应为 02")
})

test("story new 手动创建目录后自动跳过占用序号", () => {
  const dir = initRepo()
  // 手动创建 01- 目录占用序号
  fs.mkdirSync(path.join(dir, "01-已占用"), { recursive: true })
  fs.writeFileSync(path.join(dir, "01-已占用", "config.json"), "{}", "utf-8")
  fs.writeFileSync(path.join(dir, "01-已占用", "text.md"), "# 已占用", "utf-8")

  // 创建新故事，应分配到 02
  const { ok } = runCli(["new", "新故事"], dir)
  assert.ok(ok, "应创建成功")
  assert.ok(fs.existsSync(path.join(dir, "02-新故事")), "新故事应分配到序号 02")
})

test("story new 非法语言时回退默认中文", () => {
  const dir = initRepo()
  const { ok } = runCli(["new", "中文故事", "--lang=jp"], dir)
  assert.ok(ok, "非法语言应回退默认而非报错")
  const storyDir = path.join(dir, "01-中文故事")
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as { language: string }
  assert.strictEqual(config.language, "zh", "非法语言应回退到中文")
})

test("story new --author 在原创故事中保存作者", () => {
  const dir = initRepo()
  const { ok } = runCli(["new", "带作者故事", "--author=测试作者"], dir)
  assert.ok(ok, "原创故事带 --author 应成功")
  const storyDir = path.join(dir, "01-带作者故事")
  const config = JSON.parse(fs.readFileSync(path.join(storyDir, "config.json"), "utf-8")) as { author?: string }
  assert.strictEqual(config.author, "测试作者")
})
