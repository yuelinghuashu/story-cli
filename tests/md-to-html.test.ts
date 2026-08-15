import assert from "node:assert"
import { test } from "node:test"
import { mdToHtml } from "../src/render/md-to-html.ts"

test("mdToHtml null 和 undefined 输入", () => {
  assert.strictEqual(mdToHtml(undefined), "")
  assert.strictEqual(mdToHtml(null), "")
})

test("mdToHtml 只包含空白的输入", () => {
  assert.strictEqual(mdToHtml("   "), "")
  assert.strictEqual(mdToHtml("\n\n\n"), "")
})

test("mdToHtml 四个及以上 # 的标题降级为 h3", () => {
  assert.ok(mdToHtml("#### 四级标题").includes("<h3>四级标题</h3>"))
  assert.ok(mdToHtml("##### 五级标题").includes("<h3>五级标题</h3>"))
  assert.ok(mdToHtml("###### 六级标题").includes("<h3>六级标题</h3>"))
})

test("mdToHtml 表格对齐分隔符（:---:）被识别", () => {
  const md = `| 左 | 中 | 右 |
|:---|:---:|---:|
| a | b | c |`
  const result = mdToHtml(md)
  assert.ok(result.includes("<table>"))
  assert.ok(result.includes("<th>左</th>"))
  assert.ok(result.includes("<th>中</th>"))
  assert.ok(result.includes("<td>a</td>"))
})

test("mdToHtml 表格缺行时退化为普通段落", () => {
  // 只有表头没有分隔符的行，不应被当作表格
  const result = mdToHtml("| 姓名 | 年龄 |\n| 张三 | 25 |")
  assert.ok(!result.includes("<table>"))
})

test("mdToHtml 引用块多行", () => {
  const result = mdToHtml("> 第一行\n> 第二行")
  assert.ok(result.includes("<blockquote>"))
  assert.ok(result.includes("第一行"))
  assert.ok(result.includes("第二行"))
})

test("mdToHtml 引用块中的行内格式", () => {
  const result = mdToHtml("> **加粗引用** 和 `代码`")
  assert.ok(result.includes("<blockquote>"))
  assert.ok(result.includes("<strong>加粗引用</strong>"))
  assert.ok(result.includes("<code>代码</code>"))
})

test("mdToHtml 混合有序和无序列表", () => {
  const md = `- 无序一
1. 有序一
- 无序二
2. 有序二`
  const result = mdToHtml(md)
  assert.ok(result.includes("<ul>"))
  assert.ok(result.includes("<ol>"))
  assert.ok(result.includes("<li>无序一</li>"))
  assert.ok(result.includes("<li>有序二</li>"))
})

test("mdToHtml 多级嵌套列表", () => {
  const md = `- 一级A
  - 二级A1
    - 三级A1x
  - 二级A2
- 一级B`
  const result = mdToHtml(md)
  // 存在三层嵌套 ul
  assert.ok(result.includes("<li>一级A\n<ul>"))
  assert.ok(result.includes("<li>二级A1\n<ul>"))
  assert.ok(result.includes("<li>三级A1x</li>"))
  assert.ok(result.includes("<li>一级B</li>"))
})

test("mdToHtml 数字编号列表内容为空白时仍然生成 li", () => {
  const result = mdToHtml("1. 第一项\n2.")
  assert.ok(result.includes("<ol>"))
  assert.ok(result.includes("<li>第一项</li>"))
})

test("mdToHtml 行内代码中的 HTML 特殊字符被正确转义", () => {
  const result = mdToHtml("`<div>&</div>`")
  assert.ok(result.includes("<code>"))
  // 代码内部不应出现原始 <div>（被转义了）
  assert.ok(!result.includes("<div>"))
})

test("mdToHtml 转义反斜杠星号不渲染为强调", () => {
  const result = mdToHtml("\\* 不是强调 \\*")
  // 反斜杠星号应渲染为字面量 *（而非 <em>），且反斜杠被去除
  assert.ok(result.includes("* 不是强调 *"))
  assert.ok(!result.includes("\\*"))
  assert.ok(!result.includes("<em>"))
})

test("mdToHtml Emoji 和特殊 Unicode 内容", () => {
  const result = mdToHtml("🌟 中英文混合 Hello 世界 🎉")
  assert.ok(result.includes("🌟 中英文混合 Hello 世界 🎉"))
})

test("mdToHtml 中文引号和标点不被破坏", () => {
  const result = mdToHtml("「你好，世界！」——她说。")
  assert.ok(result.includes("「你好，世界！」——她说。"))
})

test("mdToHtml 空链接 label 不崩溃", () => {
  const result = mdToHtml("[](https://example.com)")
  // 空 label 链接应保留 href（或至少不崩溃）
  assert.ok(result.includes("https://example.com"))
})

test("mdToHtml 图片 alt 为空、链接 url 特殊字符", () => {
  const result = mdToHtml("![](image.png)")
  assert.ok(result.includes('<img src="image.png" alt=""/>'))
})

test("mdToHtml 图片 src 带空格和查询参数", () => {
  const result = mdToHtml("![图](cover page.png?size=large)")
  assert.ok(result.includes("cover page.png?size=large"))
})

test("mdToHtml 代码块带 no-extension 语言标记", () => {
  const result = mdToHtml("```ts\ninterface Foo { bar: string }\n```")
  assert.ok(result.includes("<pre><code>"))
  assert.ok(result.includes("interface Foo { bar: string }"))
})

test("mdToHtml 代码块内容是 JSON", () => {
  const md = '```json\n{"key": "value"}\n```'
  const result = mdToHtml(md)
  assert.ok(result.includes("<pre><code>"))
  // 双引号被转义为 "（HTML 安全）
  const amp = String.fromCharCode(38)
  assert.ok(result.includes(`{${amp}quot;key${amp}quot;: ${amp}quot;value${amp}quot;}`))
})

test("mdToHtml 代码块含闭合标签不被解析为 HTML", () => {
  const result = mdToHtml("```\n<script>alert('x')</script>\n```")
  assert.ok(result.includes("<pre><code>"))
  // script 标签内容在 HTML 转义后应原样显示（不执行）
  assert.ok(!result.includes("<script>"))
})

test("mdToHtml 水平线后跟内容", () => {
  const result = mdToHtml("---\n\n后面是内容")
  assert.ok(result.includes("<hr/>"))
  assert.ok(result.includes("后面是内容"))
})

test("mdToHtml 连续多个空段落被过滤", () => {
  const result = mdToHtml("第一段\n\n\n\n\n第二段")
  // 空块被过滤，只保留有效段落
  assert.ok(result.includes("<p>第一段</p>"))
  assert.ok(result.includes("<p>第二段</p>"))
})

test("mdToHtml 换行转换为 br", () => {
  const result = mdToHtml("第一行\n第二行")
  assert.ok(result.includes("<br/>"))
  assert.ok(result.includes("第一行"))
  assert.ok(result.includes("第二行"))
})

test("mdToHtml 链接 URL 中的 HTML 实体被过滤", () => {
  const result = mdToHtml("[xss](javascript&#58;alert(1))")
  // 编码后的 javascript: 不应渲染为链接
  assert.ok(!result.includes("<a "))
})

test("mdToHtml URL 前导空白被清理", () => {
  const result = mdToHtml("[链接](   https://example.com  )")
  assert.ok(result.includes('<a href="https://example.com">链接</a>'))
})

test("mdToHtml 多段落 + 标题 + 列表完整混合", () => {
  const md = `# 第一章

这是**正文**段落，包含 \`inline code\` 和 [链接](https://example.com)。

- 要点一
- 要点二

> 引用段落

1. 步骤一
2. 步骤二

| 列1 | 列2 |
|-----|-----|
| A   | B   |`

  const result = mdToHtml(md)
  assert.ok(result.includes("<h2>第一章</h2>"))
  assert.ok(result.includes("<strong>正文</strong>"))
  assert.ok(result.includes("<code>inline code</code>"))
  assert.ok(result.includes('<a href="https://example.com">链接</a>'))
  assert.ok(result.includes("<ul>"))
  assert.ok(result.includes("<blockquote>"))
  assert.ok(result.includes("<ol>"))
  assert.ok(result.includes("<table>"))
})

test("mdToHtml 长段文本性能（不崩溃）", () => {
  const longText = `这是第 ${"很长".repeat(1000)} 段。`.repeat(100)
  const start = Date.now()
  const result = mdToHtml(longText)
  const elapsed = Date.now() - start
  assert.ok(result.length > 0)
  // 100KB+ 文本处理应 < 500ms（宽松阈值防性能退化）
  assert.ok(elapsed < 500, `耗时 ${elapsed}ms，超过 500ms 阈值`)
})

test("mdToHtml 表格中嵌套行内格式", () => {
  const md = `| 名称 | 说明 |
|------|------|
| **加粗** | \`code\` |`
  const result = mdToHtml(md)
  assert.ok(result.includes("<td><strong>加粗</strong></td>"))
  assert.ok(result.includes("<td><code>code</code></td>"))
})

test("mdToHtml 列表项包含行内代码和链接", () => {
  const md = "- 使用 `npm install` 安装，详见 [文档](https://docs.example.com)"
  const result = mdToHtml(md)
  assert.ok(
    result.includes('<li>使用 <code>npm install</code> 安装，详见 <a href="https://docs.example.com">文档</a></li>'),
  )
})
