import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "../args.ts"
import { templatesDir } from "../utils/paths.ts"

/** 日期占位符（在模板中使用 {{DATE}} 替换为当天日期） */
const DATE_PLACEHOLDER = "{{DATE}}"

/** 脚手架模板文件映射：模板相对路径 → 目标相对路径 + 生成条件 */
const SCAFFOLD_FILES: Array<{
  template: string
  target: string
  /** 仅在 --full 时生成 */
  onlyFull?: boolean
  /** 需要替换日期占位符 */
  replaceDate?: boolean
}> = [
  { template: "scaffold/.gitignore", target: ".gitignore" },
  { template: "scaffold/README.md", target: "README.md" },
  { template: "scaffold/LICENSE", target: "LICENSE", onlyFull: true },
  { template: "scaffold/add-story.md", target: "docs/add-story.md", onlyFull: true },
  { template: "scaffold/CHANGELOG.md", target: "CHANGELOG.md", onlyFull: true, replaceDate: true },
]

/**
 * 获取当天日期（YYYY-MM-DD）
 * @returns 当天日期字符串
 */
function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 从模板文件读取内容并执行占位符替换
 * @param relPath 模板相对路径（相对 templates/）
 * @param replaceDate 是否替换 {{DATE}} 占位符
 * @returns 模板内容
 */
function readTemplate(relPath: string, replaceDate = false): string {
  let content = fs.readFileSync(path.join(templatesDir, relPath), "utf-8")
  if (replaceDate) {
    content = content.replaceAll(DATE_PLACEHOLDER, getToday())
  }
  return content
}

/**
 * 初始化一个全新的故事仓库
 * 创建模板文件与约定的目录结构（assets/、assets/sponsor/）
 * 已存在的文件不会被覆盖
 *
 * 支持 --full：额外生成 LICENSE、docs/add-story.md、CHANGELOG.md
 *
 * @param rootDir 目标目录
 * @param args CLI 参数（--full 可选）
 */
export function initProject(rootDir: string, args: string[] = []): void {
  const { options } = parseArgs(args)
  const isFull = !!options.full

  console.log("🚀 Initializing story repository...")

  // 复制模板配置，将 created 占位符替换为当天日期
  const today = getToday()
  const replaceCreated = (json: string): string => json.replace(/"created"\s*:\s*""/, `"created": "${today}"`)

  // 需要生成的文件列表：路径 → 内容（null 表示直接复制模板文件）
  const filesToWrite: Array<{ relPath: string; content: string | null }> = [
    {
      relPath: "config.original.json",
      content: replaceCreated(readTemplate("config.original.json")),
    },
    {
      relPath: "config.fanfic.json",
      content: replaceCreated(readTemplate("config.fanfic.json")),
    },
    { relPath: "story-template.md", content: readTemplate("story-template.md") },
    { relPath: "story.config.json", content: readTemplate("story.config.json") },
    // 脚手架模板：从 templates/scaffold/ 读取
    ...SCAFFOLD_FILES.filter((f) => !f.onlyFull || isFull).map((f) => ({
      relPath: f.target,
      content: readTemplate(f.template, f.replaceDate),
    })),
  ]

  // 跳过已存在的文件，避免覆盖用户已有内容
  const skipped: string[] = []
  for (const { relPath, content } of filesToWrite) {
    const fullPath = path.join(rootDir, relPath)
    // 写入前确保父目录存在（如 docs/）
    if (relPath.includes("/")) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    }
    if (fs.existsSync(fullPath)) {
      skipped.push(relPath)
      continue
    }
    fs.writeFileSync(fullPath, content ?? "", "utf-8")
  }

  // 创建约定的目录结构（含 .gitkeep 以便 Git 追踪空目录）
  const sponsorDir = path.join(rootDir, "assets", "sponsor")
  fs.mkdirSync(sponsorDir, { recursive: true })

  const gitkeepPath = path.join(sponsorDir, ".gitkeep")
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, "", "utf-8")
  }

  // 赞助目录说明文件
  const sponsorReadmePath = path.join(sponsorDir, "README.md")
  if (!fs.existsSync(sponsorReadmePath)) {
    fs.writeFileSync(
      sponsorReadmePath,
      `# ☕ 赞助支持

将收款码图片（.png / .jpg / .jpeg / .gif / .webp）放在此目录。

运行 \`story build\` 后，根目录 README 会自动生成"☕ 赞助支持"折叠区块。

**注意**：此目录是收款码专用，请勿将小说配图放在这里。
`,
      "utf-8",
    )
  }

  console.log(`
✅ Story repository initialized!

Repository structure:
  config.original.json    # 原创故事模板（story new --type=original）
  config.fanfic.json      # 二创故事模板（story new --type=fanfic）
  story-template.md       # 故事 README 的 Handlebars 模板
  story.config.json       # 仓库级配置（自定义类型/状态）
  .gitignore              # Git 忽略规则（防构建产物入库）
  README.md               # 仓库说明（build 后自动更新为完整索引）
  assets/sponsor/         # 赞助收款码目录（可选，放收款码图片）
${
  isFull
    ? `  LICENSE                 # CC BY-NC-SA 4.0 许可证
  docs/add-story.md       # 如何新增故事
  CHANGELOG.md            # 变更日志
`
    : ""
}
Next steps:
  1. Run: story new "Your Story Title"
  2. Edit the generated config.json and text.md
  3. Run: story build
`)

  if (isFull) {
    console.log("ℹ️ 已使用 --full 模式，额外生成了 LICENSE / docs/add-story.md / CHANGELOG.md")
  } else {
    console.log("ℹ️ 提示：使用 `story init --full` 可额外生成 LICENSE / docs/add-story.md / CHANGELOG.md")
  }

  if (skipped.length > 0) {
    console.log(`⚠️ Skipped existing files (not overwritten): ${skipped.join(", ")}`)
  }
}
