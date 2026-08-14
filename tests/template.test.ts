import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { renderTemplate } from "../src/render/template.ts"

function writeTempTemplate(content: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "template-test-"))
  const filePath = path.join(dir, "template.md")
  fs.writeFileSync(filePath, content, "utf-8")
  return filePath
}

test("renderTemplate 渲染简单变量", () => {
  const tpl = writeTempTemplate("标题：{{title}}")
  const result = renderTemplate(tpl, { title: "测试" })
  assert.strictEqual(result, "标题：测试")
})

test("renderTemplate eq 条件 (original/fanfic)", () => {
  const tpl = writeTempTemplate('{{#if (eq type "original")}}原创内容{{else}}二创内容{{/if}}')
  assert.strictEqual(renderTemplate(tpl, { type: "original" }), "原创内容")
  assert.strictEqual(renderTemplate(tpl, { type: "fanfic" }), "二创内容")
})

test("renderTemplate 缺少变量时输出空字符串", () => {
  const tpl = writeTempTemplate("{{missing}}")
  assert.strictEqual(renderTemplate(tpl, {}), "")
})

test("renderTemplate 渲染二创模板", () => {
  const tpl = writeTempTemplate('{{#if (eq type "fanfic")}}{{originalWork}} ({{originalAuthor}}){{else}}原创{{/if}}')
  const result = renderTemplate(tpl, {
    type: "fanfic",
    originalWork: "圣斗士星矢",
    originalAuthor: "车田正美",
  })
  assert.strictEqual(result, "圣斗士星矢 (车田正美)")
})

test("renderTemplate each 循环", () => {
  const tpl = writeTempTemplate("{{#if chapters}}\n{{#each chapters}}\n- {{title}} — {{wordCount}}\n{{/each}}\n{{/if}}")
  const result = renderTemplate(tpl, {
    chapters: [
      { title: "第一幕", wordCount: "约 3 千字" },
      { title: "第二幕", wordCount: "约 4 千字" },
    ],
  })
  assert.ok(result.includes("- 第一幕 — 约 3 千字"))
  assert.ok(result.includes("- 第二幕 — 约 4 千字"))
})

test("renderTemplate chapters 为空时不渲染", () => {
  const tpl = writeTempTemplate("{{#if chapters}}\n{{#each chapters}}\n- {{title}} — {{wordCount}}\n{{/each}}\n{{/if}}")
  const result = renderTemplate(tpl, {})
  assert.strictEqual(result, "")
})
