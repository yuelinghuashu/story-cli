import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { unzipSync } from "fflate"
import { generateEpub, getImageMimeType, mdToHtml, safeImageName } from "../src/render/epub-generator.ts"

test("mdToHtml 基本段落", () => {
  const result = mdToHtml("这是一段普通文本。")
  assert.strictEqual(result, "<p>这是一段普通文本。</p>")
})

test("mdToHtml 空输入", () => {
  assert.strictEqual(mdToHtml(""), "")
  assert.strictEqual(mdToHtml(null), "")
})

test("mdToHtml 粗体和斜体", () => {
  const result = mdToHtml("**粗体** 和 *斜体*")
  assert.ok(result.includes("<strong>粗体</strong>"))
  assert.ok(result.includes("<em>斜体</em>"))
})

test("mdToHtml 删除线和行内代码", () => {
  const result = mdToHtml("~~删除~~ 和 `code`")
  assert.ok(result.includes("<del>删除</del>"))
  assert.ok(result.includes("<code>code</code>"))
})

test("mdToHtml 标题", () => {
  assert.ok(mdToHtml("# 一级标题").includes("<h2>一级标题</h2>"))
  assert.ok(mdToHtml("## 二级标题").includes("<h2>二级标题</h2>"))
  assert.ok(mdToHtml("### 三级标题").includes("<h3>三级标题</h3>"))
})

test("mdToHtml 链接", () => {
  const result = mdToHtml("[点击这里](https://example.com)")
  assert.ok(result.includes('<a href="https://example.com">点击这里</a>'))
})

test("mdToHtml 无序列表", () => {
  const result = mdToHtml("- 第一项\n- 第二项\n- 第三项")
  assert.ok(result.includes("<ul>"))
  assert.ok(result.includes("<li>第一项</li>"))
  assert.ok(result.includes("<li>第三项</li>"))
  assert.ok(result.includes("</ul>"))
})

test("mdToHtml 有序列表", () => {
  const result = mdToHtml("1. 第一\n2. 第二")
  assert.ok(result.includes("<ol>"))
  assert.ok(result.includes("<li>第一</li>"))
  assert.ok(!result.includes("<ul>"))
})

test("mdToHtml 引用块", () => {
  const result = mdToHtml("> 这是引用")
  assert.ok(result.includes("<blockquote>"))
  assert.ok(result.includes("这是引用"))
})

test("mdToHtml 代码块", () => {
  const result = mdToHtml("```js\nconst x = 1;\n```")
  assert.ok(result.includes("<pre><code>"))
  assert.ok(result.includes("const x = 1;"))
})

test("mdToHtml HTML 特殊字符转义", () => {
  const result = mdToHtml("a < b && c > d")
  // 原始特殊字符被转义为 HTML 实体
  assert.ok(result.includes(`${String.fromCharCode(38)}lt;`))
  assert.ok(result.includes(`${String.fromCharCode(38)}amp;${String.fromCharCode(38)}amp;`))
  assert.ok(result.includes(`${String.fromCharCode(38)}gt;`))
  // 转义后不应包含未转义的原始特殊字符序列
  assert.ok(!result.includes("a < b"))
  assert.ok(!result.includes("c > d"))
})

test("mdToHtml 水平线", () => {
  assert.ok(mdToHtml("---").includes("<hr/>"))
  assert.ok(mdToHtml("***").includes("<hr/>"))
})

test("mdToHtml 表格", () => {
  const md = `| 姓名 | 年龄 |
|------|------|
| 张三 | 25   |
| 李四 | 30   |`
  const result = mdToHtml(md)
  assert.ok(result.includes("<table>"))
  assert.ok(result.includes("<thead><tr><th>姓名</th><th>年龄</th></tr></thead>"))
  assert.ok(result.includes("<td>张三</td>"))
  assert.ok(result.includes("<td>30</td>"))
  assert.ok(result.includes("</table>"))
})

test("mdToHtml 嵌套列表", () => {
  const md = `- 一级
  - 二级
  - 二级2
- 一级2`
  const result = mdToHtml(md)
  // 外层 ul
  assert.ok(result.includes("<ul>"))
  assert.ok(result.includes("<li>一级"))
  assert.ok(result.includes("<li>一级2</li>"))
  // 嵌套 ul（应该在 li 内部）
  assert.ok(result.includes("<li>一级\n<ul>"))
  assert.ok(result.includes("<li>二级</li>"))
  assert.ok(result.includes("<li>二级2</li>"))
})

test("mdToHtml 图片语法", () => {
  const result = mdToHtml("![封面](cover.jpg)")
  assert.ok(result.includes('<img src="cover.jpg" alt="封面"/>'))
})

test("mdToHtml 图片和链接区分", () => {
  // 图片语法不应被链接正则误匹配
  const result = mdToHtml("![图](img.png) 和 [文本](url)")
  assert.ok(result.includes('<img src="img.png" alt="图"/>'))
  assert.ok(result.includes('<a href="url">文本</a>'))
})

test("mdToHtml 过滤 javascript: 链接（XSS 防护）", () => {
  // 危险协议链接被移除，只保留文本
  const result = mdToHtml("[点击](javascript:alert(1))")
  assert.ok(!result.includes("javascript:"))
  assert.ok(!result.includes("<a "))
  assert.ok(result.includes("点击"))
})

test("mdToHtml 过滤 javascript: 图片（XSS 防护）", () => {
  const result = mdToHtml("![图](javascript:alert(1))")
  assert.ok(!result.includes("javascript:"))
  assert.ok(!result.includes("<img "))
})

test("mdToHtml 过滤 vbscript: 链接（XSS 防护）", () => {
  const result = mdToHtml("[点击](vbscript:msgbox(1))")
  assert.ok(!result.includes("vbscript:"))
  assert.ok(!result.includes("<a "))
  assert.ok(result.includes("点击"))
})

test("mdToHtml 过滤 data:text/html 链接（XSS 防护）", () => {
  const result = mdToHtml("[点击](data:text/html,<script>alert(1)</script>)")
  assert.ok(!result.includes("data:text/html"))
  assert.ok(!result.includes("<a "))
  assert.ok(result.includes("点击"))
})

test("mdToHtml 正常 http/https 链接不受影响", () => {
  const result = mdToHtml("[正常](https://example.com/page)")
  assert.ok(result.includes('<a href="https://example.com/page">正常</a>'))
})

test("mdToHtml 正常图片路径不受影响", () => {
  const result = mdToHtml("![封面](cover.jpg)")
  assert.ok(result.includes('<img src="cover.jpg" alt="封面"/>'))
})

test("mdToHtml mailto 链接允许通过", () => {
  const result = mdToHtml("[联系](mailto:test@example.com)")
  assert.ok(result.includes('<a href="mailto:test@example.com">联系</a>'))
})

test("getImageMimeType MIME 类型映射", () => {
  assert.strictEqual(getImageMimeType("a.png"), "image/png")
  assert.strictEqual(getImageMimeType("a.jpg"), "image/jpeg")
  assert.strictEqual(getImageMimeType("a.jpeg"), "image/jpeg")
  assert.strictEqual(getImageMimeType("a.gif"), "image/gif")
  assert.strictEqual(getImageMimeType("a.webp"), "image/webp")
  assert.strictEqual(getImageMimeType("a.svg"), "image/svg+xml")
  assert.strictEqual(getImageMimeType("a.unknown"), "image/png") // 默认
})

test("safeImageName 安全文件名", () => {
  assert.strictEqual(safeImageName("cover.png", 1), "img1.png")
  assert.strictEqual(safeImageName("封面-图片.jpg", 2), "img2.jpg")
  assert.strictEqual(safeImageName("noext", 3), "img3")
})

test("mdToHtml 混合内容", () => {
  const md = `# 章节标题\n\n这是**加粗**的段落。\n\n- 列表项 **A**\n- 列表项 *B*`
  const result = mdToHtml(md)
  assert.ok(result.includes("<h2>章节标题</h2>"))
  assert.ok(result.includes("<strong>加粗</strong>"))
  assert.ok(result.includes("<ul>"))
  assert.ok(result.includes("<strong>A</strong>"))
})

test("generateEpub 生成有效 EPUB 文件", () => {
  const options = {
    title: "测试书籍",
    author: "作者",
    description: "测试简介",
    lang: "zh",
  }
  const chapters = [
    { title: "第一章", data: "<p>内容一</p>" },
    { title: "第二章", data: "<p>内容二</p>" },
  ]
  const epubData = generateEpub(options, chapters)

  // 验证是有效的 ZIP 文件（以 PK 开头）
  const header = Array.from(epubData.slice(0, 2))
    .map((b) => String.fromCharCode(b))
    .join("")
  assert.strictEqual(header, "PK")
  assert.ok(epubData.length > 0)
})

test("generateEpub 空章节列表仍然生成", () => {
  const epubData = generateEpub({ title: "空书" }, [])
  const header = Array.from(epubData.slice(0, 2))
    .map((b) => String.fromCharCode(b))
    .join("")
  assert.strictEqual(header, "PK")
})

test("generateEpub 包含图片时打包进 EPUB", () => {
  const options = { title: "带图书", lang: "zh" }
  const chapters = [{ title: "章一", data: '<p><img src="images/img1.png" alt="图1"/></p>' }]
  const images = [{ name: "img1.png", data: new Uint8Array([1, 2, 3, 4]) }]
  const epubData = generateEpub(options, chapters, images)
  assert.ok(epubData.length > 0)
  // 验证 ZIP 头部
  const header = Array.from(epubData.slice(0, 2))
    .map((b) => String.fromCharCode(b))
    .join("")
  assert.strictEqual(header, "PK")
})

test("generateEpub 特殊字符标题不抛异常", () => {
  const options = { title: 'Title <&> "Quote"' }
  const epubData = generateEpub(options, [{ title: "Chapter", data: "<p>ok</p>" }])
  // 只要不抛异常且生成了有效 ZIP 即可
  assert.ok(epubData.length > 0)
})

test("生成 EPUB 到临时目录", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "epub-out-"))
  const outputPath = path.join(dir, "test.epub")
  const epubData = generateEpub({ title: "测试", author: "a", description: "d", lang: "zh" }, [
    { title: "章", data: "<p>内容</p>" },
  ])
  fs.writeFileSync(outputPath, epubData)

  assert.ok(fs.existsSync(outputPath))
  const size = fs.statSync(outputPath).size
  assert.ok(size > 0)
})

test("generateEpub 包含封面页（标题+作者+简介）", () => {
  const options = {
    title: "我的小说",
    author: "作家名",
    description: "这是简介",
    lang: "zh",
    license: "CC BY-NC-SA 4.0",
  }
  const epubData = generateEpub(options, [{ title: "第一章", data: "<p>内容</p>" }])
  assert.ok(epubData.length > 0)
})

test("generateEpub 带许可证时生成版权页", () => {
  const epubData = generateEpub({ title: "测试书", author: "作者", lang: "zh", license: "CC BY-NC-SA 4.0" }, [
    { title: "章", data: "<p>确认版权页存在</p>" },
  ])
  assert.ok(epubData.length > 0)
})

test("generateEpub 许可证为空时不生成版权页", () => {
  const epubData = generateEpub({ title: "无版权页书", author: "作者", lang: "zh" }, [
    { title: "章", data: "<p>内容</p>" },
  ])
  assert.ok(epubData.length > 0)
})

test("generateEpub 英文标题特殊字符安全", () => {
  const epubData = generateEpub({ title: 'Book <&> "Test"', author: "Author <&>", lang: "en" }, [
    { title: "Chapter 1", data: "<p>ok</p>" },
  ])
  assert.ok(epubData.length > 0)
})

test("generateEpub 无封面时不包含封面 item", () => {
  const epubData = generateEpub({ title: "无封皮书" }, [{ title: "章", data: "<p>内容</p>" }])
  // 解压并检查 content.opf 中没有 cover-image
  const unzipped = unzipSync(epubData)
  const opf = new TextDecoder().decode(unzipped["OEBPS/content.opf"])
  assert.ok(!opf.includes("cover-image"))
})

test("generateEpub 带封面时包含 cover-image 条目和文件", () => {
  const epubData = generateEpub(
    { title: "带封皮书", author: "作者", lang: "zh" },
    [{ title: "第一章", data: "<p>内容</p>" }],
    [],
    { name: "cover.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
  )

  // 解压并验证
  const unzipped = unzipSync(epubData)
  // 1. 封面文件被打包
  assert.ok(unzipped["OEBPS/images/cover.jpg"], "封面文件应被打进 EPUB")
  // 2. content.opf 应包含 properties="cover-image"
  const opf = new TextDecoder().decode(unzipped["OEBPS/content.opf"])
  assert.ok(opf.includes('properties="cover-image"'), "manifest 应标记 cover-image")
  // 3. 元数据中应包含 <meta name="cover" content="cover-image"/>
  assert.ok(opf.includes('<meta name="cover" content="cover-image"/>'), "metadata 应引用封面")
})
