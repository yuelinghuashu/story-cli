/**
 * 轻量重复短语检测（零依赖）
 * 定位是「写作提醒」而非「学术级 NLP」——不引入分词库（ROADMAP：复杂中文 NLP 以可选依赖外挂）
 * - 中文：字符级 bigram 词频（过滤标点 / 停用字 / 纯数字）
 * - 英文：单词词频（统一小写、剥离 's、过滤停用词）
 */
import type { Language } from "../core/types.ts"

/** 单个重复短语（含出现次数） */
export interface PhraseCount {
  phrase: string
  count: number
}

/** 中文停用字（bigram 任一字命中即跳过） */
const ZH_STOP_CHARS = new Set(
  "的了是在我你他她它们就都也有和与及很不一个上下中着过吧吗呢啊呀说要会能但而是因为之其这那没把被从对向到出起于跟给让".split(
    "",
  ),
)

/** 英文停用词（小写） */
const EN_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "without",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "mine",
  "yours",
  "hers",
  "ours",
  "theirs",
  "that",
  "this",
  "these",
  "those",
  "there",
  "here",
  "then",
  "than",
  "as",
  "by",
  "from",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "about",
  "so",
  "too",
  "not",
  "no",
  "yes",
  "do",
  "does",
  "did",
  "done",
  "have",
  "has",
  "had",
  "will",
  "would",
  "can",
  "could",
  "should",
  "may",
  "might",
  "must",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "if",
  "else",
  "because",
  "though",
  "while",
  "during",
  "before",
  "after",
])

/** CJK 统一表意文字（含扩展 A/B 区，与 word-count.ts 一致） */
const CJK_RE = /[\u4e00-\u9fa5\u3400-\u4dbf\u{20000}-\u{2A6DF}]/gu

/** 英文单词（含连字符/撇号，与 word-count.ts 一致） */
const EN_WORD_RE = /[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g

/**
 * 将文本的重复短语计数累加到 acc（可跨多个故事累加，获得全局词频）
 * @param content 正文文本
 * @param lang 语言（zh 用字符 bigram，en 用单词）
 * @param acc 累加器（可跨调用复用）
 */
export function collectPhrases(content: string, lang: Language, acc: Map<string, number>): void {
  if (!content) return

  if (lang === "en") {
    for (const match of content.toLowerCase().match(EN_WORD_RE) ?? []) {
      // 规范化：剥离 's / 're / 've / 'll / 'd / 'm 后缀
      const word = match.replace(/'(s|re|ve|ll|d|m)$/, "").replace(/[^a-z0-9]/g, "")
      if (!word || word.length < 3 || EN_STOP_WORDS.has(word)) continue
      acc.set(word, (acc.get(word) ?? 0) + 1)
    }
    return
  }

  // 中文：字符级 bigram（仅统计 CJK 字符序列内的相邻字符对）
  const chars = content.match(CJK_RE) ?? []
  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars[i]
    const b = chars[i + 1]
    if (ZH_STOP_CHARS.has(a) || ZH_STOP_CHARS.has(b)) continue
    if (/^\d$/.test(a) || /^\d$/.test(b)) continue
    const phrase = a + b
    acc.set(phrase, (acc.get(phrase) ?? 0) + 1)
  }
}

/**
 * 从累加器中取出现次数最高的 topN 个短语（次数降序，同次数按字典序保证确定性）
 * @param acc 累加器（collectPhrases 填充）
 * @param topN 返回数量，默认 10
 * @returns 排序后的短语列表
 */
export function topPhrases(acc: Map<string, number>, topN = 10): PhraseCount[] {
  return [...acc.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count || (a.phrase < b.phrase ? -1 : a.phrase > b.phrase ? 1 : 0))
    .slice(0, topN)
}

/**
 * 便捷入口：从一组正文计算全局 top 重复短语
 * 混合语言仓库时分别用各自算法累计后合并
 * @param items 故事正文（含语言）
 * @param topN 返回数量，默认 10
 * @returns 排序后的短语列表
 */
export function extractRepeatedPhrases(items: Array<{ content: string; lang: Language }>, topN = 10): PhraseCount[] {
  const acc = new Map<string, number>()
  for (const item of items) {
    collectPhrases(item.content, item.lang, acc)
  }
  return topPhrases(acc, topN)
}
