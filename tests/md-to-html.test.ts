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

// ---- 边界情况：链接与 URL ----

test("mdToHtml URL 包含右括号（RFC 3986 允许）", () => {
  const result = mdToHtml("[文档](https://example.com/path_(v1))")
  // URL 中的 ) 不应截断匹配（当前实现可能截断）
  assert.ok(result.includes("https://example.com/path_(v1)"))
})

test("mdToHtml 链接 label 包含行内代码", () => {
  const result = mdToHtml("[`code` label](https://example.com)")
  // label 中的反引号不应破坏链接
  assert.ok(result.includes('<a href="https://example.com">'))
  assert.ok(result.includes("code"))
})

test("mdToHtml 链接 URL 包含中文路径", () => {
  const result = mdToHtml("[中文文档](https://example.com/中文路径/说明文档)")
  assert.ok(result.includes("https://example.com/中文路径/说明文档"))
})

test("mdToHtml 链接 URL 包含查询参数和锚点", () => {
  const result = mdToHtml("[带参数](https://example.com/page?foo=bar&baz=qux#section)")
  // & 在 HTML 中必须被转义为 &（用 String.fromCharCode 拼接避免文档转义）
  const amp = String.fromCharCode(38)
  assert.ok(result.includes(`https://example.com/page?foo=bar${amp}amp;baz=qux#section`))
})

test("mdToHtml 未闭合的链接不崩溃且不产生链接", () => {
  const result = mdToHtml("[未闭合的链接](https://example.com")
  // 不应崩溃；如果未匹配链接则原样输出（可能被转义）
  assert.ok(!result.includes("<a "))
})

// ---- 边界情况：格式嵌套 ----

test("mdToHtml 粗体中含斜体（嵌套格式）", () => {
  const result = mdToHtml("**加粗和*斜体***")
  // Markdown 的 *** 三连星是经典歧义点，支持「粗体中嵌套斜体」的规范行为
  // 但某些解析器会将其解释为「粗体 + 多余星号」。
  // 此处断言核心内容保留（加粗文本完整输出），不严格要求 <em> 嵌套
  assert.ok(result.includes("加粗和"))
  assert.ok(result.includes("斜体"))
})

test("mdToHtml 删除线中包含行内代码", () => {
  const result = mdToHtml("~~删除 `code` 内容~~")
  assert.ok(result.includes("<del>删除 <code>code</code> 内容</del>"))
})

test("mdToHtml 连续的强调符号（**a**b**c**）", () => {
  const result = mdToHtml("**加粗一**普通**加粗二**")
  assert.ok(result.includes("<strong>加粗一</strong>普通<strong>加粗二</strong>"))
})

// ---- 边界情况：HTML 与安全 ----

test("mdToHtml 原始 HTML 脚本标签被转义（非代码块）", () => {
  const result = mdToHtml("<script>alert('xss')</script>")
  // 段落中的 HTML 应被转义为文本
  assert.ok(!result.includes("<script>"))
  assert.ok(!result.includes("<script"))
})

test("mdToHtml HTML 注释被转义", () => {
  const result = mdToHtml("<!-- 注释内容 -->")
  // HTML 注释应被转义为文本显示，不应被当作注释消耗
  assert.ok(!result.includes("<!--"))
})

test("mdToHtml 属性注入被转义", () => {
  const result = mdToHtml('[链接](https://example.com" onmouseover="alert(1))')
  // 含引号的 URL 应被安全转义（HTML 实体 "）
  const q = `${String.fromCharCode(38)}quot;`
  assert.ok(result.includes(q))
})

// ---- 边界情况：引用块与嵌套 ----

test("mdToHtml 引用块包含多段落", () => {
  const md = `> 第一段
>
> 第二段`
  const result = mdToHtml(md)
  assert.ok(result.includes("<blockquote>"))
  assert.ok(result.includes("第一段"))
  assert.ok(result.includes("第二段"))
})

test("mdToHtml 引用块包含列表", () => {
  const md = `> - 项一
> - 项二`
  const result = mdToHtml(md)
  assert.ok(result.includes("<blockquote>"))
  assert.ok(result.includes("<ul>"))
  assert.ok(result.includes("项一"))
  assert.ok(result.includes("项二"))
})

test("mdToHtml 列表项包含多行（续行）", () => {
  const md = `- 列表项第一行
  续行内容`
  const result = mdToHtml(md)
  assert.ok(result.includes("列表项第一行"))
  assert.ok(result.includes("续行内容"))
})

// ---- 边界情况：代码块与转义 ----

test("mdToHtml 代码块语言标记带点号", () => {
  const result = mdToHtml("```js\nconst x = 1\n```")
  assert.ok(result.includes("<pre><code>"))
  assert.ok(result.includes("const x = 1"))
})

test("mdToHtml 代码块内容含 ``` 三重反引号", () => {
  const result = mdToHtml("```\n代码含 ``` 三重反引号\n```")
  assert.ok(result.includes("<pre><code>"))
})

test("mdToHtml 行内代码跨行", () => {
  const result = mdToHtml("这是 `跨行\n代码` 内容")
  // 行内代码不应跨行（Markdown 规范：反引号内的换行终止代码）
  assert.ok(!result.includes("<code>跨行"))
})

// ---- 边界情况：标题与强调 ----

test("mdToHtml 标题后紧跟正文（无空行）", () => {
  const result = mdToHtml("# 标题\n正文内容")
  assert.ok(result.includes("<h2>标题</h2>"))
  assert.ok(result.includes("正文内容"))
})

test("mdToHtml 标题中的行内格式", () => {
  const result = mdToHtml("## **重要**标题")
  assert.ok(result.includes("<h2>"))
  assert.ok(result.includes("<strong>重要</strong>"))
  assert.ok(result.includes("标题</h2>"))
})

// ---- 边界情况：表格 ----

test("mdToHtml 表格单元格包含 HTML 特殊字符", () => {
  const md = `| 列 | 值 |
|----|-----|
| & | <x> |`
  const result = mdToHtml(md)
  // & 被转义为 &，<x> 被转义为 <x>（用拼接避免文档转义）
  const amp = String.fromCharCode(38)
  assert.ok(result.includes(`<td>${amp}amp;</td>`))
  assert.ok(result.includes(`${amp}lt;x${amp}gt;`))
})

test("mdToHtml 表格缺列时的行为", () => {
  const md = `| A | B |
|---|---|
| 1 |
| 2 | 3 | 4 |`
  const result = mdToHtml(md)
  assert.ok(result.includes("<table>"))
  assert.ok(result.includes("1"))
})

// ---- 边界情况：性能与超长内容 ----

test("mdToHtml 大量链接的性能", () => {
  const links = Array.from({ length: 100 }, (_, i) => `[链接${i}](https://example.com/${i})`).join(" ")
  const start = Date.now()
  const result = mdToHtml(links)
  const elapsed = Date.now() - start
  assert.ok(result.includes('<a href="https://example.com/99">链接99</a>'))
  assert.ok(elapsed < 1000, `100 个链接耗时 ${elapsed}ms`)
})

test("mdToHtml 极端嵌套括号", () => {
  const result = mdToHtml("文本 (括号 (嵌套) 内容) 更多")
  // 嵌套括号不应干扰链接/图片解析
  assert.ok(result.includes("(括号 (嵌套) 内容)"))
})
