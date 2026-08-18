/**
 * Watch 模式重建调度器
 * 从 build.ts 的 runWatchMode 中抽取的「防抖 + 串行 + 排队」调度逻辑，独立成类以便单元测试
 *
 * 解决的三类问题：
 * 1. 防抖：debounce 窗口内的连续变更合并为一次重建（避免保存文件时的中间态触发多次构建）
 * 2. 串行：同一时刻只有一个重建在运行（避免并发写 README / 资源竞争）
 * 3. 排队：重建进行中收到的新变更不丢弃，结束后立即补跑一次（修复丢失更新的竞态）
 */

/** 一次重建请求 */
export interface RebuildRequest {
  /** 触发源描述（文件名字符串，用于日志展示） */
  trigger: string
  /** 可选的故事文件夹名（增量重建提示，仅重建该故事的 README） */
  folderHint?: string
}

/** 调度器选项 */
export interface WatchSchedulerOptions {
  /** 防抖窗口（毫秒），默认 300 */
  debounceMs?: number
  /** 执行一次重建；重建期间收到的新请求会在本次结束后自动补跑 */
  onBuild: (request: RebuildRequest) => Promise<void> | void
}

export class WatchScheduler {
  private readonly debounceMs: number
  private readonly onBuild: (request: RebuildRequest) => Promise<void> | void
  private timer: ReturnType<typeof setTimeout> | null = null
  private rebuilding = false
  private pending: RebuildRequest | null = null
  private disposed = false

  constructor(options: WatchSchedulerOptions) {
    this.debounceMs = options.debounceMs ?? 300
    this.onBuild = options.onBuild
  }

  /** 请求一次重建（防抖合并：窗口内只执行最后一次） */
  request(trigger: string, folderHint?: string): void {
    if (this.disposed) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.run({ trigger, folderHint })
    }, this.debounceMs)
  }

  /** 立即执行一次初始重建（不走防抖） */
  runInitial(trigger = "initial"): void {
    if (this.disposed) return
    void this.run({ trigger })
  }

  /** 停止调度：清空待执行的重建（watch 退出时调用） */
  dispose(): void {
    this.disposed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.pending = null
  }

  private async run(request: RebuildRequest): Promise<void> {
    if (this.disposed) return
    if (this.rebuilding) {
      // 重建进行中：记录最新请求（覆盖旧请求，符合防抖语义），结束后补跑，防止变更丢失
      this.pending = request
      return
    }
    this.rebuilding = true
    try {
      await this.onBuild(request)
    } catch (e) {
      // onBuild 内部应自行捕获并输出错误；此处兜底避免未处理的 Promise 拒绝
      console.error(e)
    } finally {
      this.rebuilding = false
      if (!this.disposed && this.pending) {
        const next = this.pending
        this.pending = null
        void this.run(next)
      }
    }
  }
}
