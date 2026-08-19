import { randomUUID } from "node:crypto"
import path from "node:path"
import type { Zippable } from "fflate"
import { strToU8, zipSync } from "fflate"
import type { EpubChapter, EpubImage } from "../core/types.ts"
import { escapeHtml } from "./html-utils.ts"

/**
 * XML/HTML 转义共用同一套规则（& < > " '），复用 html-utils 的 escapeHtml
 * @param text 文本
 * @returns 转义后的文本
 */
const escapeXml = escapeHtml

/**
 * 内置排版样式表（styles.css）
 * 统一正文排版：段落 / 标题 / 引用 / 代码块 / 表格 / 图片，以及封面页居中布局。
 * 用户可通过 `story epub --css=<path>` 提供自定义样式覆盖。
 */
export const EPUB_STYLE = `/* story-cli built-in EPUB stylesheet */
body {
  font-family: "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif;
  line-height: 1.8;
  margin: 5% 6%;
  font-size: 1em;
}
h1 { font-size: 1.8em; margin: 1.2em 0 0.6em; text-align: center; }
h2 { font-size: 1.4em; margin: 1.2em 0 0.5em; }
h3 { font-size: 1.15em; margin: 1em 0 0.4em; }
p { margin: 0.6em 0; text-align: justify; }
blockquote {
  border-left: 3px solid #999;
  margin: 0.8em 0;
  padding: 0.2em 1em;
  color: #555;
}
pre, code { font-family: Consolas, Monaco, monospace; font-size: 0.9em; }
pre {
  background: #f5f5f5;
  padding: 0.8em 1em;
  white-space: pre-wrap;
  word-break: break-all;
}
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #ccc; padding: 0.4em 0.6em; text-align: left; }
img { max-width: 100%; height: auto; }
hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
/* 封面页 */
.cover { text-align: center; margin: 10% 0 1.5em 0; }
.cover img { max-width: 90%; max-height: 80%; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.title-page h1 { margin-bottom: 0.3em; }
.author { text-align: center; font-size: 1.2em; color: #555; margin-bottom: 1.5em; }
.desc { text-align: center; font-size: 0.95em; color: #777; line-height: 1.6; margin: 0 8%; }
/* 目录页 */
nav#toc h1 { text-align: center; }
nav#toc ol { padding-left: 1.2em; }
nav#toc li { margin: 0.4em 0; }
`

/**
 * 生成最小合规的 EPUB 3 文件（含 EPUB2 NCX 兼容目录）
 * 依赖：仅 fflate（ZIP 打包）
 *
 * EPUB 本质是一个 ZIP 包：
 * ├── mimetype                    ← 必须第一个且不压缩
 * ├── META-INF/container.xml      ← 指向 OPF
 * └── OEBPS/
 *     ├── content.opf             ← 元数据 + spine 清单
 *     ├── toc.xhtml               ← EPUB3 目录导航
 *     ├── toc.ncx                 ← EPUB2 兼容目录（老阅读器）
 *     ├── styles.css              ← 排版样式
 *     ├── chapterN.xhtml          ← 各章节
 *     └── images/                 ← 故事中引用的图片
 */

/**
 * 根据文件扩展名推断 MIME 类型（用于 EPUB manifest）
 * @param filePath 文件名或路径
 * @returns MIME 类型
 */
export function getImageMimeType(filePath: string): string {
  const ext = String(filePath).split(".").pop()?.toLowerCase() || ""
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
  }
  return mimeMap[ext] || "image/png" // 默认按 PNG 处理
}

/**
 * 检查 SVG 内容是否安全（XSS 防护）
 * SVG 允许包含 <script> 和事件属性（onload 等），这些在 EPUB 中会被执行
 * 允许：纯矢量图形（<svg>, <path>, <rect>, <circle> 等）
 * 禁止：<script>、事件属性（on*）、javascript: URI、<foreignObject>（嵌入式 HTML）
 * @param content SVG 文件内容（UTF-8 字符串）
 * @returns 是否安全
 */
export function isSvgSafe(content: string): boolean {
  // 禁止 <script> 标签（含大小写变种）
  if (/<script[\s>]/i.test(content)) return false
  // 禁止事件属性（onload / onclick / onerror 等）
  if (/\son[a-z]+\s*=/i.test(content)) return false
  // 禁止 javascript: URI（可出现在 href / xlink:href 中）
  if (/javascript\s*:/i.test(content)) return false
  // 禁止 <foreignObject>（可嵌入任意 HTML，绕过其他检查）
  if (/<foreignobject[\s>]/i.test(content)) return false
  // 禁止 style 元素中的 CSS 表达式注入（IE 时代 XSS，纵深防御）
  if (/\bexpression\s*\(/i.test(content)) return false
  return true
}

/**
 * 将文件名安全化为 EPUB 内部路径（去特殊字符、防冲突）
 * @param filePath 原始图片路径
 * @param index 图片序号
 * @returns 安全的文件名（如 img1.png / img2 / img3.jpg）
 */
export function safeImageName(filePath: string, index: number): string {
  const ext = path.extname(filePath).toLowerCase()
  return ext ? `img${index}${ext}` : `img${index}`
}

/**
 * 生成 EPUB 文件（Uint8Array）
 * @param options 元数据
 * @param chapters 章节列表（HTML 格式）
 * @param images 图片列表
 * @param coverImage 封面图片（可选；同时渲染到标题页并标记 cover-image）
 * @returns EPUB 文件的二进制内容
 */
export function generateEpub(
  options: {
    title: string
    author?: string
    description?: string
    lang?: string
    /** 许可证文本（可选） */
    license?: string
    /** 创建日期（YYYY-MM-DD，可选，写入 dc:date） */
    created?: string
    /** 系列名称（可选，写入 belongs-to-collection） */
    series?: string
    /** 系列内序号（可选，配合 series 写入 group-position） */
    seriesOrder?: number
    /** 自定义样式表内容（替代内置 EPUB_STYLE；由 --css 提供） */
    css?: string
  },
  chapters: EpubChapter[],
  images: EpubImage[] = [],
  coverImage?: EpubImage,
): Uint8Array {
  const {
    title,
    author = "unknown",
    description = "",
    lang = "zh",
    license = "",
    created = "",
    series,
    seriesOrder,
    css,
  } = options

  const safeTitle = escapeXml(title)
  const safeAuthor = escapeXml(author)
  const safeDesc = escapeXml(description)
  const safeLang = escapeXml(lang)
  const safeLicense = escapeXml(license)
  const safeCreated = escapeXml(created)
  const safeSeries = series ? escapeXml(series) : ""

  // ---- mimetype（必须第一个且不压缩）----
  const mimetype = strToU8("application/epub+zip")

  // ---- META-INF/container.xml ----
  const containerXml = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  // ---- 共享 UUID（dc:identifier / NCX dtb:uid 必须一致，仅生成一次）----
  const bookUid = `urn:uuid:${randomUUID()}`

  // ---- 章节序号格式化 ----
  const pad = (n: number) => String(n).padStart(3, "0")

  // ---- 样式表（内置或用户自定义）----
  const stylesCss = strToU8(css ?? EPUB_STYLE)
  const stylesheetLink = `<link rel="stylesheet" type="text/css" href="styles.css"/>`

  // ---- 图片处理 ----
  const imageFiles: Zippable = {}
  const imageItems = images.map((img, i) => {
    const safeName = img.name || `img${i + 1}.png`
    const filePath = `OEBPS/images/${safeName}`
    imageFiles[filePath] = img.data as Uint8Array<ArrayBufferLike>
    return { id: `image_${i + 1}`, href: `images/${safeName}`, mime: getImageMimeType(safeName) }
  })

  // ---- 封面图片（可选）----
  // EPUB 3 规范：manifest 中元素 properties="cover-image"
  // 元数据中通过 <meta name="cover" content="封面 item id"/> 指定
  let coverImageItem: { id: string; href: string; mime: string } | null = null
  let coverImgHtml = ""
  if (coverImage) {
    const safeName = coverImage.name || "cover.png"
    const filePath = `OEBPS/images/${safeName}`
    imageFiles[filePath] = coverImage.data as Uint8Array<ArrayBufferLike>
    coverImageItem = { id: "cover-image", href: `images/${safeName}`, mime: getImageMimeType(safeName) }
    // 封面同时渲染到标题页（居中展示）
    coverImgHtml = `<div class="cover"><img src="images/${safeName}" alt="cover"/></div>\n`
  }

  // ---- 生成各章节 XHTML ----
  const chapterFiles: Zippable = {}
  const chapterIds: Array<{ id: string; fileId: string; title: string }> = []
  const tocItems: string[] = []
  const ncxItems: string[] = []

  chapters.forEach((chapter, index) => {
    const id = `chapter${pad(index + 1)}`
    const fileId = `item_${id}`
    chapterIds.push({ id, fileId, title: chapter.title })

    const html = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${safeLang}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(chapter.title)}</title>
  ${stylesheetLink}
</head>
<body>
<h1>${escapeXml(chapter.title)}</h1>
${chapter.data}
</body>
</html>`)

    chapterFiles[`OEBPS/${id}.xhtml`] = html as Uint8Array<ArrayBufferLike>

    // EPUB3 目录项
    tocItems.push(`<li><a href="${id}.xhtml">${escapeXml(chapter.title)}</a></li>`)
    // EPUB2 NCX 目录项
    ncxItems.push(`<navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
    <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
    <content src="${id}.xhtml"/>
  </navPoint>`)
  })

  // ---- 封面页（标题 + 作者 + 简介 + 封面图）----
  const titlePageId = "titlepage"
  const titleFileId = "item_titlepage"
  const titlePageHtml = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${safeLang}">
<head>
  <meta charset="UTF-8"/>
  <title>${safeTitle}</title>
  ${stylesheetLink}
</head>
<body class="title-page">
  ${coverImgHtml}
  <h1>${safeTitle}</h1>
  <div class="author">${safeAuthor}</div>
  ${safeDesc ? `<div class="desc">${safeDesc}</div>` : ""}
</body>
</html>`)
  chapterFiles[`OEBPS/${titlePageId}.xhtml`] = titlePageHtml as Uint8Array<ArrayBufferLike>

  // ---- 版权页（可选许可证信息）----
  const copyrightItems: Array<{ id: string; fileId: string; title: string }> = []
  if (license) {
    const copyrightId = "copyright"
    const copyrightFileId = "item_copyright"
    copyrightItems.push({ id: copyrightId, fileId: copyrightFileId, title: "Copyright" })

    const copyrightHtml = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${safeLang}">
<head>
  <meta charset="UTF-8"/>
  <title>${safeTitle} — Copyright</title>
  ${stylesheetLink}
</head>
<body>
<h2>Copyright</h2>
<p>${safeLicense}</p>
</body>
</html>`)
    chapterFiles[`OEBPS/${copyrightId}.xhtml`] = copyrightHtml as Uint8Array<ArrayBufferLike>
  }

  // ---- OEBPS/toc.xhtml（EPUB3 目录导航）----
  const tocXhtml = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${safeLang}">
<head>
  <meta charset="UTF-8"/>
  <title>${safeTitle}</title>
  ${stylesheetLink}
</head>
<body>
<nav epub:type="toc" id="toc">
  <h1>${safeTitle}</h1>
  <ol>
${tocItems.join("\n")}
  </ol>
</nav>
</body>
</html>`)

  // ---- OEBPS/toc.ncx（EPUB2 兼容目录，供 Kindle/旧 ADE 使用）----
  const tocNcx = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookUid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${safeTitle}</text></docTitle>
  <navMap>
${ncxItems.join("\n")}
  </navMap>
</ncx>`)

  // ---- OEBPS/content.opf ----
  const manifestItems = [
    { id: "ncx", href: "toc.ncx", mediaType: "application/x-dtbncx+xml" },
    { id: "css", href: "styles.css", mediaType: "text/css" },
    { id: titleFileId, href: `${titlePageId}.xhtml`, mediaType: "application/xhtml+xml" },
    ...copyrightItems.map((c) => ({ id: c.fileId, href: `${c.id}.xhtml`, mediaType: "application/xhtml+xml" })),
    ...chapterIds.map(({ id, fileId }) => ({ id: fileId, href: `${id}.xhtml`, mediaType: "application/xhtml+xml" })),
  ]
    .map((item) => `<item id="${item.id}" href="${item.href}" media-type="${item.mediaType}"/>`)
    .join("\n    ")

  const imageManifestItems = imageItems
    .map((img) => `<item id="${img.id}" href="${img.href}" media-type="${img.mime}"/>`)
    .join("\n    ")

  // 封面图在 manifest 中的条目（properties="cover-image"）
  const coverManifestItem = coverImageItem
    ? `<item id="${coverImageItem.id}" href="${coverImageItem.href}" media-type="${coverImageItem.mime}" properties="cover-image"/>`
    : ""

  const spineItems = [
    { fileId: titleFileId },
    ...copyrightItems.map((c) => ({ fileId: c.fileId })),
    ...chapterIds.map(({ fileId }) => ({ fileId })),
  ]
    .map(({ fileId }) => `<itemref idref="${fileId}"/>`)
    .join("\n    ")

  // 系列元数据（EPUB 3.2：belongs-to-collection + group-position）
  const seriesMeta = safeSeries
    ? `\n    <meta property="belongs-to-collection" id="c01">${safeSeries}</meta>${seriesOrder !== undefined ? `\n    <meta refines="#c01" property="group-position">${seriesOrder}</meta>` : ""
    }`
    : ""

  const contentOpf = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="${safeLang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookUid}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:creator>${safeAuthor}</dc:creator>
    <dc:language>${safeLang}</dc:language>
    <dc:description>${safeDesc}</dc:description>
    ${safeCreated ? `<dc:date>${safeCreated}</dc:date>` : ""}
    ${safeLicense ? `<dc:rights>${safeLicense}</dc:rights>` : ""}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}/, "")}</meta>
    ${seriesMeta}
    ${coverImageItem ? `<meta name="cover" content="${coverImageItem.id}"/>` : ""}
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
    ${imageManifestItems ? `\n    ${imageManifestItems}` : ""}
    ${coverManifestItem ? `\n    ${coverManifestItem}` : ""}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`)

  // ---- 打包 ZIP ----
  // mimetype 必须使用 STORE 模式（不压缩）
  const archive: Zippable = {
    mimetype: [mimetype, { level: 0 }],
    "META-INF/container.xml": containerXml,
    "OEBPS/content.opf": contentOpf,
    "OEBPS/toc.xhtml": tocXhtml,
    "OEBPS/toc.ncx": tocNcx,
    "OEBPS/styles.css": stylesCss,
    ...chapterFiles,
    ...imageFiles,
  }

  return zipSync(archive)
}
