/**
 * 命令注册表（单一事实来源）
 * 所有 CLI 命令在此集中声明，cli.ts 的 help 输出和 docs/commands.md 均由此派生
 * 新增命令时只需在此添加一条，避免多处手写漂移
 */

/** 命令分类 */
export type CommandCategory = "init" | "content" | "build" | "export" | "ai" | "system"

/** 子命令定义 */
export interface SubcommandDef {
  name: string
  usage: string
  description: string
}

/** 单个命令定义 */
export interface CommandDef {
  /** 主命令名（cli.ts 用） */
  name: string
  /** 命令简写别名（如 'b'、'n'、'i'）—— 仅第一位置参数生效 */
  aliases?: string[]
  /** 全局标志（如 '--help'、'-v'）—— 在任意位置生效，优先于命令分发 */
  flags?: string[]
  /** 一行用法示例（story xxx ...） */
  usage: string
  /** 一句话描述（英文，help 输出和 docs/commands.en.md） */
  description: string
  /** 一句话描述（中文，README 和 docs/commands.md） */
  descriptionZh: string
  /** 所属分类（help 按分类分组输出） */
  category: CommandCategory
  /** 子命令（export、import 等） */
  subcommands?: SubcommandDef[]
  /** 对应的主题文档路径（docs/export.md 等），无则为 undefined */
  doc?: string
}

/** 所有命令的完整声明（与 cli.ts switch 严格对齐） */
export const COMMANDS: CommandDef[] = [
  // ─── init ────────────────────────────────────────────────────
  {
    name: "init",
    aliases: ["i"],
    usage: "story init [--template=story|knowledge|tech] [--full]",
    description: "Initialize a story repository (or knowledge / tech docs)",
    descriptionZh: "初始化仓库（默认故事/知识库/技术文档模式）",
    category: "init",
    doc: "docs/add-story.md",
  },

  // ─── content ─────────────────────────────────────────────────
  {
    name: "new",
    aliases: ["n"],
    usage: 'story new "标题" [--type=original|fanfic] [--author="原作"] [--creator="原作者"] [--lang=zh|en]',
    description: "Create a new story (with config.json + text.md)",
    descriptionZh: "创建新故事（生成 config.json + text.md）",
    category: "content",
    doc: "docs/add-story.md",
  },

  // ─── build ───────────────────────────────────────────────────
  {
    name: "build",
    aliases: ["b"],
    usage: "story build [--validate-only] [--save-counts] [--watch]",
    description: "Generate all READMEs",
    descriptionZh: "生成所有 README",
    category: "build",
    doc: "docs/add-story.md",
  },

  // ─── export ──────────────────────────────────────────────────
  {
    name: "export",
    usage: "story export <format> [--stdout] [--output=dir]",
    description: "Export stories in various formats",
    descriptionZh: "导出多种格式",
    category: "export",
    subcommands: [
      { name: "html", usage: "story export html [--output=dir]", description: "static HTML site" },
      { name: "txt", usage: "story export txt [--stdout] [--output=dir]", description: "plain text" },
      { name: "json", usage: "story export json [--stdout] [--output=dir]", description: "structured JSON" },
      {
        name: "md",
        usage: "story export md [--stdout] [--output=dir]",
        description: "merged Markdown with YAML frontmatter",
      },
      {
        name: "embeddings",
        usage: "story export embeddings [--stdout] [--output=dir]",
        description: "text chunks as JSONL (for embedding services)",
      },
    ],
    doc: "docs/export.md",
  },

  // ─── import ──────────────────────────────────────────────────
  {
    name: "import",
    usage: "story import <format> [--file=path] [--output=dir]",
    description: "Import stories from structured files",
    descriptionZh: "从结构化文件导入故事",
    category: "export",
    subcommands: [
      { name: "json", usage: "story import json --file=stories.json [--output=dir]", description: "import from JSON" },
    ],
    doc: "docs/export.md",
  },

  // ─── epub ────────────────────────────────────────────────────
  {
    name: "epub",
    aliases: ["e"],
    usage: 'story epub "标题" | story epub --all | story epub "标题" --split-by-volume',
    description: "Export stories to EPUB 3 (e-reader format)",
    descriptionZh: "导出 EPUB 3 电子书（支持分卷/封面/图片）",
    category: "export",
    doc: "docs/epub.md",
  },

  // ─── stats ───────────────────────────────────────────────────
  {
    name: "stats",
    aliases: ["s"],
    usage: "story stats [--json]",
    description: "Show writing statistics",
    descriptionZh: "创作数据统计",
    category: "build",
    doc: "docs/design.md",
  },

  // ─── validate ────────────────────────────────────────────────
  {
    name: "validate",
    aliases: ["check"],
    usage: "story validate [--json]",
    description: "Check repository compliance against Story-Repo spec",
    descriptionZh: "合规检查（Story-Repo 规范）",
    category: "build",
    doc: "docs/specification.md",
  },

  // ─── link ────────────────────────────────────────────────────
  {
    name: "link",
    usage: "story link <source> <target> | story link --remove=<target> <source> | story link --list [source]",
    description: "Manage related stories (weak relation)",
    descriptionZh: "管理故事关联（弱关联 links）",
    category: "content",
    doc: "docs/add-story.md",
  },

  // ─── demo ────────────────────────────────────────────────────
  {
    name: "demo",
    usage: "story demo",
    description: "Generate a demo story repository",
    descriptionZh: "生成示例故事仓库",
    category: "init",
  },

  // ─── mcp-server ──────────────────────────────────────────────
  {
    name: "mcp-server",
    aliases: ["mcp"],
    usage: "story mcp-server",
    description: "Start MCP stdio server (AI client connection entry)",
    descriptionZh: "启动 MCP Server（AI 客户端连接入口）",
    category: "ai",
    doc: "docs/mcp.md",
  },

  // ─── help ────────────────────────────────────────────────────
  {
    name: "help",
    aliases: ["h"],
    flags: ["--help", "-h"],
    usage: "story help",
    description: "Show this help",
    descriptionZh: "显示帮助信息",
    category: "system",
  },

  // ─── version ─────────────────────────────────────────────────
  {
    name: "version",
    flags: ["--version", "-v"],
    usage: "story version",
    description: "Show version",
    descriptionZh: "显示版本号",
    category: "system",
  },
]

/** 分类的顺序与展示名 */
export const CATEGORIES: { id: CommandCategory; label: string; labelZh: string }[] = [
  { id: "init", label: "📦 Initialize", labelZh: "📦 初始化" },
  { id: "content", label: "✍️ Content", labelZh: "✍️ 内容" },
  { id: "build", label: "🔨 Build & Validate", labelZh: "🔨 构建与校验" },
  { id: "export", label: "📤 Export & Import", labelZh: "📤 导出与导入" },
  { id: "ai", label: "🤖 AI Integration", labelZh: "🤖 AI 集成" },
  { id: "system", label: "🖥️ System", labelZh: "🖥️ 系统" },
]

/**
 * 按分类获取命令列表
 * @param category 分类 ID
 * @returns 该分类下的命令
 */
export function getCommandsByCategory(category: CommandCategory): CommandDef[] {
  return COMMANDS.filter((c) => c.category === category)
}
