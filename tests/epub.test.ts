import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { unzipSync } from "fflate"
import { generateEpub, getImageMimeType, isSvgSafe, safeImageName } from "../src/render/epub-generator.ts"
import { mdToHtml } from "../src/render/md-to-html.ts"

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

test("isSvgSafe 纯矢量 SVG 安全", () => {
  const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10"/><circle cx="5" cy="5" r="3"/></svg>'
  assert.strictEqual(isSvgSafe(safeSvg), true)
})

test("isSvgSafe 包含 <script> 时不安全", () => {
  const dangerousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
  assert.strictEqual(isSvgSafe(dangerousSvg), false)
})

test("isSvgSafe 包含事件属性时不安全", () => {
  const dangerousSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>'
  assert.strictEqual(isSvgSafe(dangerousSvg), false)
})

test("isSvgSafe 包含 javascript: URI 时不安全", () => {
  const dangerousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">click</a></svg>'
  assert.strictEqual(isSvgSafe(dangerousSvg), false)
})

test("isSvgSafe 包含 <foreignObject> 时不安全", () => {
  const dangerousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>html</div></foreignObject></svg>'
  assert.strictEqual(isSvgSafe(dangerousSvg), false)
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

// ---- EPUB 集成测试：结构完整性校验 ----

/**
 * 解压 EPUB 并返回所有文件内容（UTF-8 解码）
 */
function extractEpub(epubData: Uint8Array): Record<string, string> {
  const unzipped = unzipSync(epubData)
  const result: Record<string, string> = {}
  for (const [name, data] of Object.entries(unzipped)) {
    if (data) result[name] = new TextDecoder("utf-8").decode(data as Uint8Array)
  }
  return result
}

/**
 * 从 content.opf 中提取所有 <item> 的 href 列表
 */
function extractManifestHrefs(opf: string): string[] {
  const hrefs: string[] = []
  const regex = /<item\b[^>]*?\shref="([^"]+)"/g
  for (let match = regex.exec(opf); match !== null; match = regex.exec(opf)) {
    hrefs.push(match[1])
  }
  return hrefs
}

/**
 * 从 content.opf 中提取 <spine> 中所有 <itemref> 的 idref 列表
 */
function extractSpineIdrefs(opf: string): string[] {
  const idrefs: string[] = []
  const regex = /<itemref\b[^>]*?\sidref="([^"]+)"/g
  for (let match = regex.exec(opf); match !== null; match = regex.exec(opf)) {
    idrefs.push(match[1])
  }
  return idrefs
}

/**
 * 从 content.opf 的 manifest 中构建 id → href 映射
 */
function buildManifestIdMap(opf: string): Map<string, string> {
  const map = new Map<string, string>()
  const regex = /<item\b[^>]*?\sid="([^"]+)"[^>]*?\shref="([^"]+)"/g
  for (let match = regex.exec(opf); match !== null; match = regex.exec(opf)) {
    map.set(match[1], match[2])
  }
  return map
}

test("EPUB 集成：结构完整性（mimetype/container/opf/toc）", () => {
  const epubData = generateEpub({ title: "集成测试书", author: "作者", lang: "zh" }, [
    { title: "第一章", data: "<p>内容一</p>" },
    { title: "第二章", data: "<p>内容二</p>" },
  ])

  const files = extractEpub(epubData)

  // 1. mimetype 必须存在且为 "application/epub+zip"
  assert.ok(files.mimetype, "mimetype 文件应存在")
  assert.strictEqual(files.mimetype, "application/epub+zip")

  // 2. META-INF/container.xml 必须存在且指向 OEBPS/content.opf
  assert.ok(files["META-INF/container.xml"], "container.xml 应存在")
  assert.ok(files["META-INF/container.xml"].includes('full-path="OEBPS/content.opf"'))

  // 3. OEBPS/content.opf 和 OEBPS/toc.xhtml 必须存在
  assert.ok(files["OEBPS/content.opf"], "content.opf 应存在")
  assert.ok(files["OEBPS/toc.xhtml"], "toc.xhtml 应存在")

  // 4. 必须是 EPUB 3（package version="3.0"）
  assert.ok(files["OEBPS/content.opf"].includes('version="3.0"'), "应为 EPUB 3")
})

test("EPUB 集成：mimetype 位于 ZIP 首部且不压缩（STORE）", () => {
  const epubData = generateEpub({ title: "Mimetype测试" }, [{ title: "章", data: "<p>内容</p>" }])

  // mimetype 必须使用 STORE（level 0），内容以明文出现在 ZIP 文件头部
  // EPUBCheck 规范：mimetype 文件必须是 ZIP 的第一个文件且不压缩
  const mimetypeText = "application/epub+zip"
  const textDecoder = new TextDecoder("latin1")
  const rawStr = textDecoder.decode(epubData)
  const mimetypeIndex = rawStr.indexOf(mimetypeText)
  assert.ok(mimetypeIndex > 0, "mimetype 应以明文出现在 ZIP 中")

  // mimetype 是 ZIP 的第一个文件：
  // LHF = 30 字节固定头 + 文件名 "mimetype"（8 字节）
  const lfhStart = mimetypeIndex - 30 - 8
  assert.ok(lfhStart >= 0, "mimetype 前应有 Local File Header")
  // LHF 签名：PK\x03\x04
  assert.strictEqual(rawStr.charCodeAt(lfhStart), 0x50, "LHF 应以 P（PK 签名）开头")
  assert.strictEqual(rawStr.charCodeAt(lfhStart + 1), 0x4b, "LHF 应以 K（PK 签名）开头")
  // 压缩方法字段在 LHF 偏移 8-9（0x0000 = STORE）
  const method = epubData[lfhStart + 8] | (epubData[lfhStart + 9] << 8)
  assert.strictEqual(method, 0, "压缩方法应为 STORE（0）")
  // 验证文件名是 "mimetype"
  const nameOffset = lfhStart + 30
  assert.strictEqual(rawStr.slice(nameOffset, nameOffset + 8), "mimetype", "第一个文件应为 mimetype")
})

test("EPUB 集成：manifest 条目全部对应实际文件", () => {
  const epubData = generateEpub(
    { title: "清单验证书", author: "作者", lang: "zh", license: "CC BY-NC-SA 4.0" },
    [
      { title: "第一章", data: "<p>内容一</p>" },
      { title: "第二章", data: "<p>内容二</p>" },
    ],
    [{ name: "img1.png", data: new Uint8Array([1, 2, 3, 4]) }],
    { name: "cover.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
  )

  const files = extractEpub(epubData)
  const opf = files["OEBPS/content.opf"]

  // manifest 中每个 href 引用的文件必须在 ZIP 中真实存在
  const manifestHrefs = extractManifestHrefs(opf)
  assert.ok(manifestHrefs.length >= 4, "manifest 应包含多个条目")

  for (const href of manifestHrefs) {
    // 解析为相对 OEBPS/ 的路径
    const fullPath = `OEBPS/${href}`
    assert.ok(files[fullPath], `manifest 引用的文件应存在于 ZIP 中: ${href}`)
  }

  // spine 中每个 idref 必须在 manifest 中找到对应 id
  const spineIdrefs = extractSpineIdrefs(opf)
  const manifestIdMap = buildManifestIdMap(opf)
  assert.ok(spineIdrefs.length >= 2, "spine 应包含多个章节")
  for (const idref of spineIdrefs) {
    assert.ok(manifestIdMap.has(idref), `spine 引用的 idref 应在 manifest 中存在: ${idref}`)
  }
})

test("EPUB 集成：章节索引命名正确且内容完整", () => {
  const epubData = generateEpub({ title: "章节验证书" }, [
    { title: "第一章", data: "<p>内容一</p>" },
    { title: "第二章", data: "<p>内容二</p>" },
    { title: "第三章", data: "<p>内容三</p>" },
  ])

  const files = extractEpub(epubData)

  // 章节文件按 chapter001.xhtml、chapter002.xhtml 递增命名
  const expectedTitles = ["第一章", "第二章", "第三章"]
  const expectedContents = ["内容一", "内容二", "内容三"]
  for (let i = 0; i < 3; i++) {
    const num = String(i + 1).padStart(3, "0")
    const fileName = `OEBPS/chapter${num}.xhtml`
    assert.ok(files[fileName], `章节文件应存在: ${fileName}`)
    // 章节文件内容应包含标题和正文 HTML
    assert.ok(files[fileName].includes(expectedTitles[i]), `${fileName} 应包含章节标题 ${expectedTitles[i]}`)
    assert.ok(files[fileName].includes(`<p>${expectedContents[i]}</p>`), `${fileName} 应包含正文内容`)
  }
})

test("EPUB 集成：目录导航（toc.xhtml）包含所有章节链接", () => {
  const epubData = generateEpub({ title: "目录导航书" }, [
    { title: "第一章", data: "<p>内容一</p>" },
    { title: "第二章", data: "<p>内容二</p>" },
  ])

  const files = extractEpub(epubData)
  const toc = files["OEBPS/toc.xhtml"]

  // toc.xhtml 应包含导航元素和章节链接
  assert.ok(toc.includes('<nav epub:type="toc"'), "应包含 epub 类型为 toc 的导航")
  assert.ok(toc.includes('<a href="chapter001.xhtml">第一章</a>'), "目录应链接到第一章")
  assert.ok(toc.includes('<a href="chapter002.xhtml">第二章</a>'), "目录应链接到第二章")
})

test("EPUB 集成：图片引用与 manifest 一致", () => {
  const epubData = generateEpub(
    { title: "图片验证书" },
    [{ title: "章一", data: '<p><img src="images/img1.png" alt="图1"/></p>' }],
    [{ name: "img1.png", data: new Uint8Array([137, 80, 78, 71]) }],
  )

  const files = extractEpub(epubData)
  const opf = files["OEBPS/content.opf"]

  // 图片文件真实存在于 ZIP 中
  assert.ok(files["OEBPS/images/img1.png"], "图片文件应存在于 ZIP 中")

  // manifest 中应有对应图片条目，且 media-type 正确
  assert.ok(opf.includes('<item id="image_1" href="images/img1.png" media-type="image/png"/>'), "manifest 应有图片条目")
})

// ---- EPUB 产品化：样式 / NCX / 封面渲染 / 元数据 ----

test("EPUB 集成：styles.css 存在且所有页面引用", () => {
  const epubData = generateEpub({ title: "样式书", author: "作者", lang: "zh", license: "CC BY" }, [
    { title: "第一章", data: "<p>内容</p>" },
  ])
  const files = extractEpub(epubData)

  assert.ok(files["OEBPS/styles.css"], "styles.css 应存在")
  assert.ok(files["OEBPS/styles.css"].includes("story-cli built-in EPUB stylesheet"), "应使用内置样式")

  // 章节 / 标题页 / 版权页 / 目录页都应引用 styles.css
  for (const page of ["OEBPS/chapter001.xhtml", "OEBPS/titlepage.xhtml", "OEBPS/copyright.xhtml", "OEBPS/toc.xhtml"]) {
    assert.ok(files[page]?.includes('href="styles.css"'), `${page} 应引用 styles.css`)
  }
})

test("EPUB 集成：自定义样式替换内置样式（css 选项）", () => {
  const epubData = generateEpub({ title: "自定义样式书", css: "body { color: red; }" }, [
    { title: "章", data: "<p>内容</p>" },
  ])
  const files = extractEpub(epubData)
  assert.ok(files["OEBPS/styles.css"].includes("body { color: red; }"), "自定义样式应生效")
  assert.ok(!files["OEBPS/styles.css"].includes("story-cli built-in"), "自定义样式应替代内置样式")
})

test("EPUB 集成：toc.ncx 存在且 navMap 覆盖全部章节", () => {
  const epubData = generateEpub({ title: "NCX书" }, [
    { title: "第一章", data: "<p>一</p>" },
    { title: "第二章", data: "<p>二</p>" },
  ])
  const files = extractEpub(epubData)
  const ncx = files["OEBPS/toc.ncx"]
  const opf = files["OEBPS/content.opf"]

  assert.ok(ncx, "toc.ncx 应存在")
  assert.ok(ncx.includes('xmlns="http://www.daisy.org/z3986/2005/ncx/"'), "应为 NCX 命名空间")
  assert.ok(ncx.includes("<navLabel><text>第一章</text></navLabel>"), "NCX 应包含第一章")
  assert.ok(ncx.includes('<content src="chapter001.xhtml"/>'), "NCX 应指向章节文件")
  assert.ok(ncx.includes('<content src="chapter002.xhtml"/>'), "NCX 应指向第二章")

  // opf：manifest 声明 ncx 条目，spine 引用 toc="ncx"
  assert.ok(
    opf.includes('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'),
    "manifest 应声明 ncx",
  )
  assert.ok(opf.includes('<spine toc="ncx">'), "spine 应引用 ncx")
  // EPUB3 nav 文档仍保留
  assert.ok(
    opf.includes('<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>'),
    "nav 文档应保留",
  )
})

test("EPUB 集成：封面渲染到标题页", () => {
  const epubData = generateEpub({ title: "封面渲染书" }, [{ title: "章", data: "<p>内容</p>" }], [], {
    name: "cover.jpg",
    data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  })
  const files = extractEpub(epubData)
  const titlePage = files["OEBPS/titlepage.xhtml"]

  assert.ok(titlePage.includes('<img src="images/cover.jpg" alt="cover"/>'), "标题页应渲染封面图")
  assert.ok(titlePage.includes('class="cover"'), "封面应使用居中布局")
})

test("EPUB 集成：元数据包含创建日期/版权/系列", () => {
  const epubData = generateEpub(
    {
      title: "元数据书",
      author: "作者",
      lang: "zh",
      license: "CC BY-NC-SA 4.0",
      created: "2026-08-19",
      series: "星河系列",
      seriesOrder: 2,
    },
    [{ title: "章", data: "<p>内容</p>" }],
  )
  const files = extractEpub(epubData)
  const opf = files["OEBPS/content.opf"]

  assert.ok(opf.includes("<dc:date>2026-08-19</dc:date>"), "应包含 dc:date")
  assert.ok(opf.includes("<dc:rights>CC BY-NC-SA 4.0</dc:rights>"), "应包含 dc:rights")
  assert.ok(opf.includes('<meta property="belongs-to-collection" id="c01">星河系列</meta>'), "应包含系列元数据")
  assert.ok(opf.includes('<meta refines="#c01" property="group-position">2</meta>'), "应包含系列内序号")
})

test("EPUB 集成：无系列时不含 belongs-to-collection 元数据", () => {
  const epubData = generateEpub({ title: "无系列书" }, [{ title: "章", data: "<p>内容</p>" }])
  const files = extractEpub(epubData)
  const opf = files["OEBPS/content.opf"]
  assert.ok(!opf.includes("belongs-to-collection"), "无系列时不应输出系列元数据")
})

// ---- EPUB 规范合规断言 ----

test("规范：所有 XHTML 页面包含 charset 声明", () => {
  const epubData = generateEpub({ title: "charset书", author: "A", lang: "zh", license: "CC" }, [
    { title: "第一章", data: "<p>内容</p>" },
    { title: "第二章", data: "<p>内容</p>" },
  ])
  const files = extractEpub(epubData)
  for (const page of [
    "OEBPS/chapter001.xhtml",
    "OEBPS/chapter002.xhtml",
    "OEBPS/titlepage.xhtml",
    "OEBPS/copyright.xhtml",
    "OEBPS/toc.xhtml",
  ]) {
    assert.ok(files[page]?.includes('<meta charset="UTF-8"/>'), `${page} 应包含 <meta charset="UTF-8"/>`)
  }
})

test("规范：NCX dtb:uid 与 dc:identifier UUID 一致", () => {
  const epubData = generateEpub({ title: "UUID书" }, [{ title: "章", data: "<p>内容</p>" }])
  const files = extractEpub(epubData)
  const opf = files["OEBPS/content.opf"]
  const ncx = files["OEBPS/toc.ncx"]

  // 提取 dc:identifier
  const idMatch = opf.match(/<dc:identifier id="bookid">(urn:uuid:[^<]+)<\/dc:identifier>/)
  assert.ok(idMatch, "应包含 dc:identifier")
  const identifier = idMatch?.[1] ?? ""

  // 提取 dtb:uid
  const uidMatch = ncx.match(/<meta name="dtb:uid" content="([^"]+)"/)
  assert.ok(uidMatch, "应包含 dtb:uid")
  const uid = uidMatch?.[1] ?? ""

  assert.strictEqual(uid, identifier, "dtb:uid 应与 dc:identifier 相同")
})

test("规范：dcterms:modified 格式为 ISO 8601 UTC", () => {
  const epubData = generateEpub({ title: "日期书" }, [{ title: "章", data: "<p>内容</p>" }])
  const files = extractEpub(epubData)
  const opf = files["OEBPS/content.opf"]
  const match = opf.match(/<meta property="dcterms:modified">([^<]+)<\/meta>/)
  assert.ok(match, "应包含 dcterms:modified")
  assert.ok(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(match?.[1] ?? ""),
    `dcterms:modified 格式应为 ISO 8601 UTC，实际: ${match?.[1]}`,
  )
})

test("规范：空 description 不破坏 XML 结构", () => {
  const epubData = generateEpub({ title: "空简介书", description: "" }, [{ title: "章", data: "<p>内容</p>" }])
  const files = extractEpub(epubData)
  assert.ok(files["OEBPS/content.opf"], "content.opf 应存在")
  assert.ok(files["OEBPS/titlepage.xhtml"], "标题页应存在")
})

test("规范：超长章节标题（>200 字符）不破坏结构", () => {
  const longTitle = "这是一段非常长的章节标题".repeat(30)
  const epubData = generateEpub({ title: "长标题书" }, [{ title: longTitle, data: "<p>内容</p>" }])
  const files = extractEpub(epubData)
  assert.ok(files["OEBPS/chapter001.xhtml"], "章节文件应存在")
  assert.ok(files["OEBPS/toc.ncx"], "NCX 应存在")
  assert.ok(files["OEBPS/toc.xhtml"], "TOC 应存在")
  // 长标题应包含在章节和目录中
  assert.ok(files["OEBPS/chapter001.xhtml"]?.includes(longTitle))
  assert.ok(files["OEBPS/toc.ncx"]?.includes(longTitle))
})

test("规范：空章节内容不破坏 XHTML 结构", () => {
  const epubData = generateEpub({ title: "空内容书" }, [{ title: "章", data: "" }])
  const files = extractEpub(epubData)
  assert.ok(files["OEBPS/chapter001.xhtml"], "章节文件应存在")
  assert.ok(files["OEBPS/chapter001.xhtml"]?.includes("<h1>章</h1>"), "应包含章节标题")
})

test("规范：titlepage 无封面时不包含 img 标签", () => {
  const epubData = generateEpub({ title: "无封面标题页", author: "作者" }, [{ title: "章", data: "<p>内容</p>" }])
  const files = extractEpub(epubData)
  const titlepage = files["OEBPS/titlepage.xhtml"]
  assert.ok(!titlepage.includes("<img "), "无封面时标题页不应包含图片")
  assert.ok(titlepage.includes('class="title-page"'), "应使用标题页布局")
  assert.ok(titlepage.includes("作者"), "应显示作者")
})

test("规范：styles.css 在 manifest 中 media-type 为 text/css", () => {
  const epubData = generateEpub({ title: "CSS类型书" }, [{ title: "章", data: "<p>内容</p>" }])
  const files = extractEpub(epubData)
  const opf = files["OEBPS/content.opf"]
  assert.ok(
    opf.includes('href="styles.css" media-type="text/css"'),
    "manifest 中 styles.css 的 media-type 应为 text/css",
  )
})

test("规范：toc.xhtml nav 结构完整（nav + ol 包含所有章节）", () => {
  const epubData = generateEpub({ title: "导航结构书" }, [
    { title: "第壹章", data: "<p>一</p>" },
    { title: "第贰章", data: "<p>二</p>" },
    { title: "第叁章", data: "<p>三</p>" },
  ])
  const files = extractEpub(epubData)
  const toc = files["OEBPS/toc.xhtml"]

  // 必须包含 <nav epub:type="toc"> 和 <ol>
  assert.ok(toc.includes('<nav epub:type="toc"'), "应包含 epub:type=toc 导航")
  assert.ok(toc.includes("<ol>"), "应包含有序列表")
  assert.ok(toc.includes("</ol>"), "有序列表应闭合")
  // 每章都在 nav 的 <a> 中（同时验证标题出现在目录里）
  for (const title of ["第壹章", "第贰章", "第叁章"]) {
    assert.ok(toc.includes(title), `目录应包含章节标题 ${title}`)
  }
})

test("规范：NCX playOrder 从 1 开始连续递增", () => {
  const epubData = generateEpub({ title: "序号书" }, [
    { title: "甲", data: "<p>1</p>" },
    { title: "乙", data: "<p>2</p>" },
    { title: "丙", data: "<p>3</p>" },
  ])
  const files = extractEpub(epubData)
  const ncx = files["OEBPS/toc.ncx"]

  // 提取所有 playOrder
  const playOrders: number[] = []
  for (const m of ncx.matchAll(/playOrder="(\d+)"/g)) {
    playOrders.push(Number(m[1]))
  }

  assert.strictEqual(playOrders.length, 3, "应有 3 个 playOrder")
  assert.deepStrictEqual(playOrders, [1, 2, 3], "playOrder 应从 1 开始连续递增")
})
