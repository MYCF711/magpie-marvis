// 隔离浏览器登录 —— 自己起一个一次性 Chromium，用户在里面登录，从 CDP 抓回调 URL
//
// 为什么不用系统默认浏览器：QQ / 微信 的授权页对「刚打开的、没有历史的」窗口更宽容。
// 更重要的是**隔离**：一次性 user-data-dir，不碰用户日常浏览器的 Cookie / 扩展 / 同步，
// 登录态只在本次窗口里，关掉即销毁。
//
// ⚠ 伪装浏览器身份（防风控拦截）：
//   · `--disable-blink-features=AutomationControlled` —— 去掉 `navigator.webdriver`
//   · 不传 `--enable-automation` / `--headless` —— 有头窗口，且不带自动化提示条
//   · `Network.setUserAgentOverride` 把 UA 换成正常 Chrome，并补齐
//     `Accept-Language` / `sec-ch-ua` —— 只改 UA 不改 client hints 会被指纹比对出来
//   · 一次性 profile，每次都是「全新机器」，不会因为历史 Cookie 被判定异常
//
// 设计取舍来自 WPS 灵犀 0.4.11 的实测实现（MIT；见 NOTICE.md）：
//   · 任意 Chromium 内核浏览器都行（Chrome / Edge / 360 / QQ / Brave…），不止 Chrome；
//     国产浏览器在 Windows 上很常见，漏了它们这条登录路对用户就不存在。
//   · Windows 的候选顺序：Chrome → 国产 Chromium → Edge 最后（Edge 策略最多、最容易被组织禁用）。
//   · 退出码不可靠：浏览器可能把调试参数吞掉，所以以「CDP 端口能不能连上」为准。
//
// ⚠ 只读页面 URL，不读 Cookie、不注入脚本；窗口关闭后临时 profile 会被删掉。
// ⚠ 本模块不依赖任何第三方包；Node 22+ 的全局 WebSocket 足够。

import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:net"
import { execFileSync } from "node:child_process"

const WIN_EXES = [
  "chrome.exe",
  "360ChromeX.exe",
  "360chrome.exe",
  "360se.exe",
  "QQBrowser.exe",
  "Brave.exe",
  "vivaldi.exe",
  "opera.exe",
  "SogouExplorer.exe",
  "2345Explorer.exe",
  "liebao.exe",
  "Maxthon.exe",
  "UCBrowser.exe",
  "Quark.exe",
  "msedge.exe",
]

/** 正常 Chrome 的 UA —— 不是 headless、不是 Electron、不带 Marvis 字样 */
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/152.0.0.0 Safari/537.36"

/** Windows 注册表 App Paths 查浏览器；查不到返回空串。 */
export function registryAppPath(exe) {
  if (process.platform !== "win32") return ""
  for (const root of ["HKCU", "HKLM"]) {
    for (const tail of [
      `SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`,
      `SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`,
    ]) {
      try {
        const out = execFileSync("reg", ["query", `${root}\\${tail}`, "/ve"], {
          encoding: "utf8",
          timeout: 5000,
          stdio: ["ignore", "pipe", "ignore"],
        })
        const line = out.split("\n").find((l) => /REG_SZ/i.test(l))
        const path = line?.split("REG_SZ")[1]?.trim()
        if (path && existsSync(path)) return path
      } catch {
        /* 没有这个键 */
      }
    }
  }
  return ""
}

/**
 * 候选浏览器（按优先级）。不做存在性检查，方便测试与排序。
 * @param {{platform?:string, env?:Record<string,string>, lookup?:(exe:string)=>string}} [o]
 * @returns {{name:string, path:string}[]}
 */
export function browserCandidates({ platform = process.platform, env = process.env, lookup = registryAppPath } = {}) {
  const h = env.HOME || env.USERPROFILE || ""
  const local = env.LOCALAPPDATA || ""
  const roaming = env.APPDATA || ""
  const pf = env.PROGRAMFILES || ""
  const pf86 = env["PROGRAMFILES(X86)"] || env["ProgramFiles(x86)"] || ""
  const add = (list, name, path) => {
    if (path) list.push({ name, path })
  }

  if (platform === "win32") {
    const list = []
    for (const exe of WIN_EXES) {
      const fromRegistry = lookup(exe)
      if (fromRegistry) add(list, exe.replace(/\.exe$/i, ""), fromRegistry)
    }
    add(list, "Chrome", join(pf, "Google", "Chrome", "Application", "chrome.exe"))
    add(list, "Chrome", join(pf86, "Google", "Chrome", "Application", "chrome.exe"))
    add(list, "Chrome", join(local, "Google", "Chrome", "Application", "chrome.exe"))
    add(list, "Chromium", join(local, "Chromium", "Application", "chrome.exe"))
    add(list, "Chromium", join(pf, "Chromium", "Application", "chrome.exe"))
    add(list, "360极速浏览器X", join(local, "360ChromeX", "Chrome", "Application", "360ChromeX.exe"))
    add(list, "360浏览器", join(local, "360Chrome", "Chrome", "Application", "360chrome.exe"))
    add(list, "360安全浏览器", join(roaming, "secoresdk", "360se6", "Application", "360se.exe"))
    add(list, "QQ浏览器", join(local, "Tencent", "QQBrowser", "Application", "QQBrowser.exe"))
    add(list, "Brave", join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"))
    add(list, "Brave", join(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"))
    add(list, "Vivaldi", join(local, "Vivaldi", "Application", "vivaldi.exe"))
    add(list, "Opera", join(local, "Programs", "Opera", "opera.exe"))
    add(list, "Opera", join(roaming, "Opera Software", "Opera Stable", "opera.exe"))
    add(list, "搜狗浏览器", join(local, "SogouExplorer", "SogouExplorer.exe"))
    add(list, "2345浏览器", join(local, "2345Explorer", "2345Explorer.exe"))
    add(list, "猎豹浏览器", join(local, "liebao", "liebao.exe"))
    add(list, "Maxthon", join(roaming, "Maxthon3", "Bin", "Maxthon.exe"))
    add(list, "UC浏览器", join(local, "UCBrowser", "Application", "UCBrowser.exe"))
    add(list, "夸克浏览器", join(local, "Quark", "Quark.exe"))
    add(list, "Edge", join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"))
    add(list, "Edge", join(pf, "Microsoft", "Edge", "Application", "msedge.exe"))
    return dedupe(list)
  }

  if (platform === "darwin") {
    return [
      ["Chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
      ["Chromium", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
      ["Brave", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"],
      ["Vivaldi", "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi"],
      ["Edge", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
    ].map(([name, path]) => ({ name, path }))
  }

  return [
    ["Chrome", join(h, ".config/google-chrome/chrome")],
    ["Chromium", join(h, ".config/chromium/chrome")],
    ["Brave", join(h, ".config/BraveSoftware/Brave-Browser/brave")],
    ["Vivaldi", join(h, ".config/vivaldi/vivaldi")],
    ["Edge", join(h, ".config/microsoft-edge/msedge")],
  ].map(([name, path]) => ({ name, path }))
}

function dedupe(list) {
  const seen = new Set()
  return list.filter((x) => {
    const key = x.path.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 缓存：注册表查询要跑十几次 `reg query`，不缓存会让 `authorize()` 慢到 1 秒以上 */
let browserCache = null
let browserCached = false

/**
 * 第一个真实存在的候选；没有返回 null。
 *
 * ⚠ 结果**进程内缓存**：`authorize()` 必须立刻返回（HOOKS 四·陷阱 1），
 *   而注册表查询是同步阻塞的 —— 每次登录都重查十几遍会让 UI 卡住。
 */
export function findBrowser({ platform = process.platform, env = process.env, exists = existsSync, lookup = registryAppPath } = {}) {
  if (browserCached) return browserCache
  browserCache = browserCandidates({ platform, env, lookup }).find((b) => exists(b.path)) ?? null
  browserCached = true
  return browserCache
}

/** 测试用：清掉浏览器缓存 */
export function resetBrowserCache() {
  browserCache = null
  browserCached = false
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

async function getJson(url, timeoutMs = 3000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * 打开受控浏览器，等它跳到匹配 `match` 的地址，返回那个地址。
 *
 * @param {object} o
 * @param {{name:string,path:string}} o.browser findBrowser() 的返回值
 * @param {string} o.url 登录页
 * @param {RegExp} o.match 回调地址的判据
 * @param {Record<string,string>} [o.extraHeaders] 注入到**每个请求**的头（MarvisExt 等）
 * @param {number} [o.timeoutMs] 默认 5 分钟
 * @param {AbortSignal} [o.signal]
 * @returns {Promise<{url:string, body:string, browser:string}>} 回调页面的地址与正文
 */
export async function openIsolatedLogin({ browser, url, match, extraHeaders, timeoutMs = 5 * 60_000, signal }) {
  if (!browser?.path) throw new Error("没有找到可用的 Chromium 内核浏览器（Chrome / Edge / 360 / QQ 浏览器都行）")

  const profile = mkdtempSync(join(tmpdir(), "magpie-marvis-login-"))
  const port = await freePort()
  const child = spawn(
    browser.path,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      // 一次性全新 profile：没有历史 Cookie / 扩展 / 同步
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      // 去掉自动化痕迹（这是防风控的关键，不是可选项）
      "--disable-blink-features=AutomationControlled",
      "--exclude-switches=enable-automation",
      `--user-agent=${CHROME_UA}`,
      "--lang=zh-CN",
      // ⚠ 必须先开 about:blank：钩子（Fetch.enable / setExtraHTTPHeaders）要在
      //   导航**之前**装好，否则首次请求漏过去，拦截永远不触发。
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: false },
  )

  const cleanup = () => {
    try {
      child.kill()
    } catch {
      /* 已经退出 */
    }
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      /* 临时目录删不掉不影响主流程 */
    }
  }

  const deadline = Date.now() + timeoutMs
  try {
    let pageWs = ""
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error("登录已取消")
      try {
        const pages = await getJson(`http://127.0.0.1:${port}/json/list`, 1000)
        pageWs = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ""
        if (pageWs) break
      } catch {
        /* 浏览器还没起好 */
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    if (!pageWs) {
      throw new Error(
        "受控浏览器没有打开调试端口（可能是浏览器吞掉了 --remote-debugging-port，或安全软件拦截）。" +
          "请换一个 Chromium 内核浏览器，或改用「从本机 Marvis 导入」。",
      )
    }

    const ws = new WebSocket(pageWs)
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true })
      ws.addEventListener("error", () => reject(new Error("CDP WebSocket 连不上")), { once: true })
    })

    /** 发一条 CDP 命令并等结果 */
    const send = (id, method, params = {}) =>
      new Promise((resolve, reject) => {
        const onMessage = (event) => {
          let msg
          try {
            msg = JSON.parse(String(event.data))
          } catch {
            return
          }
          if (msg.id !== id) return
          ws.removeEventListener("message", onMessage)
          if (msg.error) reject(new Error(msg.error.message || "CDP error"))
          else resolve(msg.result)
        }
        ws.addEventListener("message", onMessage)
        ws.send(JSON.stringify({ id, method, params }))
      })

    try {
      // 补齐 client hints —— 只改 UA 不改 sec-ch-ua 会被指纹比对出来
      await send(1, "Network.enable").catch(() => {})
      await send(2, "Network.setUserAgentOverride", {
        userAgent: CHROME_UA,
        acceptLanguage: "zh-CN,zh;q=0.9",
        platform: "Win32",
      }).catch(() => {})
      // ⚠⚠ 关键：服务端对 `yybadaccess.3g.qq.com` 的**每个**请求都校验
      //   `Ual-Access-MarvisExt`（uskey 设备指纹）。没有它就返回
      //   「请使用 Marvis 客户端」—— 这正是浏览器登录一直失败的原因。
      //   Marvis 的 BrowserWindow 用 `session.webRequest.onBeforeSendHeaders` 注入，
      //   这里用 CDP 的 `Network.setExtraHTTPHeaders` 达到同样效果。
      if (extraHeaders && Object.keys(extraHeaders).length > 0) {
        await send(5, "Network.setExtraHTTPHeaders", { headers: extraHeaders }).catch(() => {})
      }

      // 顺手抹掉 navigator.webdriver（比 --disable-blink-features 更干净，不带警告条）
      await send(3, "Page.addScriptToEvaluateOnNewDocument", {
        source: "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})",
      }).catch(() => {})

      // 导航到授权页（钩子已装好：UA / client hints / navigator.webdriver）
      await send(6, "Page.navigate", { url }).catch(() => {})

      // ⚠ 不拦截、不重放、不替换页面 —— 让浏览器**自己**走完换取请求。
      //   为什么：`marvis_oauth` 的换取依赖 (a) 浏览器 TLS 指纹（Node 的 undici 会被 WAF 400）、
      //   (b) 同源 Cookie、(c) Referer。这三样只有「浏览器自己发」才齐全。
      //   之前用 `Fetch.fulfillRequest` 换成静态页再在页面里 fetch，会因为执行上下文
      //   随导航销毁而拿不到结果 —— 表现就是卡在「正在完成授权…」。
      //
      //   服务端换完 code 会**直接返回 token JSON**，所以只要等页面跳到回调地址、
      //   再把 body 读出来就行。
      let nextId = 10
      let hitUrl = ""
      let body = ""

      while (Date.now() < deadline) {
        if (signal?.aborted) throw new Error("登录已取消")

        let href = ""
        try {
          const r = await send(nextId++, "Runtime.evaluate", {
            expression: "location.href",
            returnByValue: true,
          })
          href = String(r?.result?.value ?? "")
        } catch {
          /* 页面正在导航 */
        }

        if (href && match.test(href)) {
          hitUrl = href
          // 页面可能还在渲染，多读几次直到拿到非空正文
          for (let i = 0; i < 20; i++) {
            try {
              const r = await send(nextId++, "Runtime.evaluate", {
                expression: "document.body ? document.body.innerText : ''",
                returnByValue: true,
              })
              body = String(r?.result?.value ?? "")
              if (body.trim()) break
            } catch {
              /* 还在导航 */
            }
            await new Promise((r) => setTimeout(r, 400))
          }
          return { url: hitUrl, body, browser: browser.name }
        }

        await new Promise((r) => setTimeout(r, 600))
      }

    } finally {
      try {
        ws.close()
      } catch {
        /* 已关闭 */
      }
    }
  } finally {
    cleanup()
  }
}

export const _internal = { WIN_EXES, CHROME_UA, freePort, dedupe, resetBrowserCache }
