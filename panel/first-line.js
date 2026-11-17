// 首行改写面板（magpie.panels，slot: provider）
//
// 它出现在**每个 provider 编辑器**里，只读写本插件自己的选项：
//   options.firstLine = { mode: "off" | "blocked" | "always", text: "…" }
// 与 src/hooks/loader.mjs 的 firstLineOption() 是同一个字段 —— 面板只是把它做成开关，
// 不再是让人手写 JSON。
//
// ⚠ options.set 是**整份替换**，所以每次都要把读到的 opts 展开再写回，
//   否则将来的新字段会被这次保存抹掉。
// ⚠ magpie 对 options 的写入限流：一秒最多一次 ⇒ 用 1.2s 防抖，别每个按键都打。

(async () => {
  const MODES = ["off", "blocked", "always"]
  const FALLBACK = "You are a helpful assistant."

  const $ = (id) => document.getElementById(id)
  const modeEl = $("mode")
  const textEl = $("text")
  const savedEl = $("saved")

  const STRINGS = {
    zh: {
      title: "首行改写",
      mode: "模式",
      text: "首行文本",
      saved: "已保存 · 下一个请求起生效",
      failed: "保存失败：",
      offline: "读数失败，先按默认值显示：",
      empty: `留空 = 用内置兜底句 ${FALLBACK}（不含任何 agent 产品名）`,
    },
    en: {
      title: "First-line rewrite",
      mode: "Mode",
      text: "First line",
      saved: "Saved · takes effect on the next request",
      failed: "Could not save: ",
      offline: "Could not read the options; showing defaults: ",
      empty: `Empty = the built-in ${FALLBACK} (no agent product name in it)`,
    },
  }

  await magpie.ready

  const lang = String(magpie.theme?.lang || document.documentElement.lang || "en").toLowerCase()
  const t = STRINGS[lang.startsWith("zh") ? "zh" : "en"]
  $("title").textContent = t.title
  $("mode-label").textContent = t.mode
  $("text-label").textContent = t.text
  textEl.placeholder = FALLBACK
  $("hint-text").textContent = t.empty

  /** @type {Record<string, unknown>} 读到的整份选项 —— 保存时要原样带回去 */
  let opts = {}
  try {
    const got = await magpie.options.get()
    if (got && typeof got === "object" && !Array.isArray(got)) opts = got
  } catch (err) {
    savedEl.textContent = t.offline + (err?.message || err)
  }

  const cur = opts.firstLine && typeof opts.firstLine === "object" ? opts.firstLine : {}
  modeEl.value = MODES.includes(cur.mode) ? cur.mode : "blocked"
  textEl.value = typeof cur.text === "string" ? cur.text : ""

  let timer = 0
  const save = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const next = {
        ...opts,
        firstLine: { mode: MODES.includes(modeEl.value) ? modeEl.value : "blocked", text: textEl.value },
      }
      try {
        const back = await magpie.options.set(next)
        if (back && typeof back === "object" && !Array.isArray(back)) opts = back
        else opts = next
        savedEl.textContent = t.saved
      } catch (err) {
        savedEl.textContent = t.failed + (err?.message || err)
      }
    }, 1200)
  }

  modeEl.addEventListener("change", save)
  textEl.addEventListener("input", save)
  textEl.addEventListener("change", save)
})()
