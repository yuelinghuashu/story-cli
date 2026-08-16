/**
 * 故事序号管理
 * 为 new-story.ts 和 import-json.ts 提供共享的下一个序号生成逻辑
 */
import { scanStoryFolders } from "./scanner.ts"

/**
 * 获取下一个可用序号
 * 逻辑：扫描符合 NN- 前缀约定的故事文件夹，取最大序号 + 1
 * 使用 scanStoryFolders 而非手写 readdirSync，确保正确排除基础设施目录和 .storyignore
 * @param rootDir 项目根目录
 * @returns 两位数字序号（如 "01"、"02"、"12"）
 */
export function getNextNumber(rootDir: string): string {
  const folders = scanStoryFolders(rootDir)
  let max = 0
  for (const folder of folders) {
    const num = parseInt(folder.split("-")[0], 10)
    if (!Number.isNaN(num) && num > max) max = num
  }
  return String(max + 1).padStart(2, "0")
}
