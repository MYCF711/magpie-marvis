// 首行文本面板（magpie.panels，slot: provider）
//
// 只做一件事：把 `magpie.options.firstLine.text` 做成一个**输入框**。
// 开关是 magpie 原生渲染的（`auth.options`，只支持布尔），文本没有原生控件，所以走面板。
//
// ⚠ options.set 是**整份替换**（一秒最多一次）：
//   每次都要把读到的 opts 展开再写回，否则会把别的键抹掉；输入用 1.2s 防抖。

(async () => {
  const FALLBACK = "You are a helpful assistant."
  const $ = (id) => document.getElementById(id)
  const input = $("text")
  const saved = $("saved")

  const STRINGS = {
    zh: {
      title: "首行文本",
      label: "首行",
      hint: "「每个请求都改写首行」打开时，system 提示词的第一行会被换成下面这句；留空 = 内置兜底句。",
      note: `留空 = ${FALLBACK}（不含任何 agent 产品名）`,
      done: "已保存 · 下一个请求起生效",
      fail: "保存失败：",
      readFail: "读数失败，先按默认显示：",
    },
    en: {
      title: "First line text",
      label: "First line",
      hint: "With “every request” on, the system prompt's first line becomes this one; empty = the built-in fallback.",
      note: `Empty = ${FALLBACK} (no agent product name in it)`,
      done: "Saved · takes effect on the next request",
      fail: "Could not save: ",
      readFail: "Could not read the options; showing defaults: ",
    },
  }

  await magpie.ready

  const lang = String(magpie.theme?.lang || document.documentElement.lang || "en").toLowerCase()
  const t = STRINGS[lang.startsWith("zh") ? "zh" : "en"]
  $("title").textContent = t.title
  $("text-label").textContent = t.label
  $("hint").textContent = t.hint
  $("fallback-note").textContent = t.note
  input.placeholder = FALLBACK

  /** 读到的整份选项 —— 写回时必须原样带上 */
  let opts = {}
  try {
    const got = await magpie.options.get()
    if (got && typeof got === "object" && !Array.isArray(got)) opts = got
  } catch (err) {
    saved.textContent = t.readFail + (err?.message || err)
  }

  const firstLine = opts.firstLine && typeof opts.firstLine === "object" ? opts.firstLine : {}
  input.value = typeof firstLine.text === "string" ? firstLine.text : ""

  let timer = 0
  const save = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const next = { ...opts, firstLine: { ...firstLine, text: input.value } }
      try {
        const back = await magpie.options.set(next)
        opts = back && typeof back === "object" && !Array.isArray(back) ? back : next
        saved.textContent = t.done
      } catch (err) {
        saved.textContent = t.fail + (err?.message || err)
      }
    }, 1200)
  }

  input.addEventListener("input", save)
  input.addEventListener("change", save)
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      clearTimeout(timer)
      save()
    }
  })
})()
