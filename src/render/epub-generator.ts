import path from "node:path"
import type { Zippable } from "fflate"
import { strToU8, zipSync } from "fflate"
import type { EpubChapter, EpubImage } from "../core/types.ts"

// 使用 String.fromCharCode 拼接 HTML 实体，避免字符串被 XML 解析器转义
const AMP = `${String.fromCharCode(38)}amp;`
const LT = `${String.fromCharCode(38)}lt;`
const GT = `${String.fromCharCode(38)}gt;`
const QUOT = `${String.fromCharCode(38)}quot;`
const APOS = `${String.fromCharCode(38)}apos;`

/**
 * 生成最小合规的 EPUB 3 文件
 * 依赖：仅 fflate（ZIP 打包）
 *
 * EPUB 本质是一个 ZIP 包：
 * ├── mimetype                    ← 必须第一个且不压缩
 * ├── META-INF/container.xml      ← 指向 OPF
 * └── OEBPS/
 *     ├── content.opf             ← 元数据 + spine 清单
 *     ├── toc.xhtml               ← 目录导航
 *     ├── chapterN.xhtml          ← 各章节
 *     └── images/                 ← 故事中引用的图片
 */

/**
 * 转义 XML 特殊字符
 * @param text 文本
 * @returns 转义后的文本
 */
function escapeXml(text: unknown): string {
  return String(text).replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT).replace(/"/g, QUOT).replace(/'/g, APOS)
}

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
 * @param coverImage 封面图片（可选）
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
  },
  chapters: EpubChapter[],
  images: EpubImage[] = [],
  coverImage?: EpubImage,
): Uint8Array {
  const { title, author = "unknown", description = "", lang = "zh", license = "" } = options

  const safeTitle = escapeXml(title)
  const safeAuthor = escapeXml(author)
  const safeDesc = escapeXml(description)
  const safeLang = escapeXml(lang)
  const safeLicense = escapeXml(license)

  // ---- mimetype（必须第一个且不压缩）----
  const mimetype = strToU8("application/epub+zip")

  // ---- META-INF/container.xml ----
  const containerXml = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  // ---- 章节序号格式化 ----
  const pad = (n: number) => String(n).padStart(3, "0")

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
  if (coverImage) {
    const safeName = coverImage.name || "cover.png"
    const filePath = `OEBPS/images/${safeName}`
    imageFiles[filePath] = coverImage.data as Uint8Array<ArrayBufferLike>
    coverImageItem = { id: "cover-image", href: `images/${safeName}`, mime: getImageMimeType(safeName) }
  }

  // ---- 生成各章节 XHTML ----
  const chapterFiles: Zippable = {}
  const chapterIds: Array<{ id: string; fileId: string; title: string }> = []
  const tocItems: string[] = []

  chapters.forEach((chapter, index) => {
    const id = `chapter${pad(index + 1)}`
    const fileId = `item_${id}`
    chapterIds.push({ id, fileId, title: chapter.title })

    const html = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${safeLang}">
<head>
  <title>${escapeXml(chapter.title)}</title>
</head>
<body>
<h1>${escapeXml(chapter.title)}</h1>
${chapter.data}
</body>
</html>`)

    chapterFiles[`OEBPS/${id}.xhtml`] = html as Uint8Array<ArrayBufferLike>

    // 目录项
    tocItems.push(`<li><a href="${id}.xhtml">${escapeXml(chapter.title)}</a></li>`)
  })

  // ---- 封面页（标题 + 作者 + 简介）----
  const titlePageId = "titlepage"
  const titleFileId = "item_titlepage"
  const titlePageHtml = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${safeLang}">
<head>
  <title>${safeTitle}</title>
  <style>
    body { text-align: center; margin: 20% 10% 0 10%; }
    h1 { font-size: 2.4em; margin-bottom: 0.5em; }
    .author { font-size: 1.3em; color: #555; margin-bottom: 2em; }
    .desc { font-size: 1em; color: #777; line-height: 1.6; }
  </style>
</head>
<body>
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
  <title>${safeTitle} — Copyright</title>
</head>
<body>
<h2>Copyright</h2>
<p>${safeLicense}</p>
</body>
</html>`)
    chapterFiles[`OEBPS/${copyrightId}.xhtml`] = copyrightHtml as Uint8Array<ArrayBufferLike>
  }

  // ---- OEBPS/toc.xhtml（目录）----
  const tocXhtml = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${safeLang}">
<head>
  <title>${safeTitle}</title>
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

  // ---- OEBPS/content.opf ----
  const manifestItems = [
    { id: titleFileId, href: `${titlePageId}.xhtml` },
    ...copyrightItems.map((c) => ({ id: c.fileId, href: `${c.id}.xhtml` })),
    ...chapterIds.map(({ id, fileId }) => ({ id: fileId, href: `${id}.xhtml` })),
  ]
    .map((item) => `<item id="${item.id}" href="${item.href}" media-type="application/xhtml+xml"/>`)
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

  const contentOpf = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="${safeLang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${generateUuid()}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:creator>${safeAuthor}</dc:creator>
    <dc:language>${safeLang}</dc:language>
    <dc:description>${safeDesc}</dc:description>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}/, "")}Z</meta>
    ${coverImageItem ? `<meta name="cover" content="${coverImageItem.id}"/>` : ""}
  </metadata>
  <manifest>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
    ${imageManifestItems ? `\n    ${imageManifestItems}` : ""}
    ${coverManifestItem ? `\n    ${coverManifestItem}` : ""}
  </manifest>
  <spine toc="toc">
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
    ...chapterFiles,
    ...imageFiles,
  }

  return zipSync(archive)
}

/**
 * 生成随机 UUID（用于 EPUB 标识符）
 * @returns UUID 字符串
 */
function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
