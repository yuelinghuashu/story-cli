import assert from "node:assert"
import { test } from "node:test"
import { collectPhrases, extractRepeatedPhrases, topPhrases } from "../src/utils/phrase-frequency.ts"

test("中文 bigram：统计相邻汉字对", () => {
  const acc = new Map<string, number>()
  collectPhrases("星光闪烁，星光闪烁。", "zh", acc)
  // "星光闪烁" 出现两次 → "星光" ×2、"光闪" ×2、"闪烁" ×2
  assert.strictEqual(acc.get("星光"), 2)
  assert.strictEqual(acc.get("光闪"), 2)
  assert.strictEqual(acc.get("闪烁"), 2)
})

test("中文 bigram：跳过停用字", () => {
  const acc = new Map<string, number>()
  collectPhrases("我是一颗星，你是月亮。", "zh", acc)
  // "我是" / "是一" / "一颗" / "颗星" 中 "是""一""我" 为停用字 → 跳过
  assert.ok(!acc.has("我是"), "包含停用字 '我' 的 bigram 应跳过")
  assert.ok(!acc.has("是一"), "包含停用字 '是' 的 bigram 应跳过")
  assert.strictEqual(acc.get("颗星"), 1)
})

test("中文 bigram：跳过标点与数字", () => {
  const acc = new Map<string, number>()
  collectPhrases("2026年计划。", "zh", acc)
  assert.ok(!acc.has("20"), "数字 bigram 应跳过")
  assert.strictEqual(acc.get("计划"), 1, "计划 应被统计") // 年 不是停用字
})

test("英文单词：统计词频并跳过停用词", () => {
  const acc = new Map<string, number>()
  collectPhrases("The cat and the dog. The cat is fast.", "en", acc)
  assert.strictEqual(acc.get("cat"), 2)
  assert.strictEqual(acc.get("dog"), 1)
  assert.ok(!acc.has("the"), "停用词 the 应被过滤")
  assert.ok(!acc.has("and"), "停用词 and 应被过滤")
})

test("英文单词：统一小写并剥离 's 后缀", () => {
  const acc = new Map<string, number>()
  collectPhrases("story's ending, Story begins", "en", acc)
  assert.strictEqual(acc.get("story"), 2, "story's 与 Story 应归并为 story")
  assert.strictEqual(acc.get("ending"), 1)
  assert.strictEqual(acc.get("begins"), 1)
})

test("英文单词：短词（<3 字符）跳过", () => {
  const acc = new Map<string, number>()
  collectPhrases("a b c go go go", "en", acc)
  assert.ok(!acc.has("go"), "2 字符词应跳过（长度不足 3）")
  assert.strictEqual(acc.size, 0)
})

test("空内容不报错", () => {
  const acc = new Map<string, number>()
  collectPhrases("", "zh", acc)
  collectPhrases("   ", "en", acc)
  assert.strictEqual(acc.size, 0)
})

test("topPhrases 按次数降序，同次数按字典序（确定性）", () => {
  const acc = new Map<string, number>()
  acc.set("alpha", 3)
  acc.set("beta", 5)
  acc.set("gamma", 5)
  acc.set("delta", 1)
  const top = topPhrases(acc, 3)
  assert.deepStrictEqual(
    top.map((p) => p.phrase),
    ["beta", "gamma", "alpha"],
    "次数降序；同次数 beta < gamma 字典序",
  )
  assert.deepStrictEqual(
    top.map((p) => p.count),
    [5, 5, 3],
  )
})

test("extractRepeatedPhrases 混合语言全局累计", () => {
  const items = [
    { content: "星光闪烁，星光闪烁。", lang: "zh" as const },
    { content: "star light star light", lang: "en" as const },
  ]
  const repeated = extractRepeatedPhrases(items, 5)
  const zh = repeated.find((p) => p.phrase === "星光")
  const en = repeated.find((p) => p.phrase === "star")
  assert.ok(zh, "中文 bigram 应进入全局结果")
  assert.strictEqual(zh?.count, 2)
  assert.ok(en, "英文单词应进入全局结果")
  assert.strictEqual(en?.count, 2)
})
