import assert from "node:assert"
import { test } from "node:test"
import { WatchScheduler } from "../src/core/watch-scheduler.ts"

test("防抖：窗口内连续请求合并为一次重建（保留最后一次触发）", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
    },
  })

  scheduler.request("a")
  scheduler.request("b")
  scheduler.request("c")

  // 防抖窗口未到：不执行
  t.mock.timers.tick(299)
  assert.deepStrictEqual(calls, [], "窗口内不应执行重建")

  // 窗口到达：只执行最后一次
  t.mock.timers.tick(1)
  assert.deepStrictEqual(calls, ["c"], "防抖合并后只执行最后一次请求")

  scheduler.dispose()
})

test("runInitial 立即执行，不走防抖", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
    },
  })

  scheduler.runInitial()
  assert.deepStrictEqual(calls, ["initial"], "初始构建应立即执行")

  scheduler.dispose()
})

test("重建进行中收到新请求不丢失，结束后立即补跑", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  let release: () => void = () => {}
  // 用可控 Promise 让第一次重建保持「进行中」状态
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const scheduler = new WatchScheduler({
    debounceMs: 300,
    onBuild: (req) => {
      calls.push(req.trigger)
      return gate
    },
  })

  // 第一次重建开始，阻塞在 gate 上
  scheduler.runInitial("first")
  assert.deepStrictEqual(calls, ["first"], "第一次重建应立即开始")

  // 重建进行中收到新请求：不应执行，但也不应丢弃
  scheduler.request("second")
  t.mock.timers.tick(300) // 防抖计时器触发 → 发现重建中 → 排队
  await Promise.resolve()
  assert.deepStrictEqual(calls, ["first"], "重建进行中不应执行第二个请求")

  // 放行第一次重建 → 排队请求应自动补跑
  release()
  await gate
  await Promise.resolve()
  await Promise.resolve()
  assert.deepStrictEqual(calls, ["first", "second"], "重建结束后应补跑排队中的请求")

  scheduler.dispose()
})

test("重建中连续收到多个请求时只补跑最新一次（防抖语义）", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
      return gate
    },
  })

  scheduler.runInitial("first")
  scheduler.request("second")
  scheduler.request("third")
  scheduler.request("fourth")
  t.mock.timers.tick(300)
  await Promise.resolve()
  assert.deepStrictEqual(calls, ["first"])

  release()
  await gate
  await Promise.resolve()
  await Promise.resolve()
  assert.deepStrictEqual(calls, ["first", "fourth"], "排队期间只保留最新请求")

  scheduler.dispose()
})

test("dispose 后请求不再触发重建", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
    },
  })

  scheduler.dispose()
  scheduler.request("a")
  scheduler.runInitial("b")
  t.mock.timers.tick(1000)
  assert.deepStrictEqual(calls, [], "dispose 后不应执行任何重建")

  scheduler.dispose() // 幂等
})

test("dispose 时清空未执行的防抖计时器", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
    },
  })

  scheduler.request("a") // 防抖计时器待执行
  scheduler.dispose() // 应清空计时器
  t.mock.timers.tick(1000)
  assert.deepStrictEqual(calls, [], "dispose 后待执行的防抖请求不应触发")

  scheduler.dispose()
})

test("onBuild 抛错时被捕获，后续请求仍可正常调度", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  let shouldThrow = true
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
      if (shouldThrow) {
        shouldThrow = false
        throw new Error("模拟构建失败")
      }
    },
  })

  // 捕获 console.error 避免测试输出噪音
  const originalError = console.error
  let errorLogged = ""
  console.error = (msg: unknown) => {
    errorLogged = String(msg)
  }
  try {
    scheduler.runInitial("boom")
    assert.strictEqual(calls[0], "boom", "第一次构建应执行")
    assert.ok(errorLogged.includes("模拟构建失败"), "onBuild 抛错应被调度器捕获并输出")

    // 抛错后调度器不应卡死：后续请求仍能执行
    scheduler.request("after")
    t.mock.timers.tick(300)
    assert.deepStrictEqual(calls, ["boom", "after"], "抛错后后续请求应正常调度")
  } finally {
    console.error = originalError
  }

  scheduler.dispose()
})

test("dispose 后进行中的重建结束时不再补跑排队请求", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
      return gate
    },
  })

  scheduler.runInitial("first")
  scheduler.request("second")
  t.mock.timers.tick(300)
  await Promise.resolve()

  scheduler.dispose()
  release()
  await gate
  await Promise.resolve()
  await Promise.resolve()
  assert.deepStrictEqual(calls, ["first"], "dispose 后排队请求不应补跑")

  scheduler.dispose()
})

test("默认防抖窗口为 300ms", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const calls: string[] = []
  const scheduler = new WatchScheduler({
    onBuild: (req) => {
      calls.push(req.trigger)
    },
  })

  scheduler.request("a")
  t.mock.timers.tick(299)
  assert.deepStrictEqual(calls, [])
  t.mock.timers.tick(1)
  assert.deepStrictEqual(calls, ["a"])

  scheduler.dispose()
})
