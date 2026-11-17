// tests/panel-manifest.test.mjs —— 面板清单与打包面的回归锁
//
// 背景：magpie 的插件面板（magpie.panels）是「provider 编辑器里的一块 iframe」，
// 它的失败方式是**静默的**：
//   · `file` 不在包的 files 白名单里 → npm 装出来没有这个文件，面板空白，没有任何报错；
//   · `slot` 写错（比如 "providers"）→ 永远不出现在任何页面；
//   · 忘了 `<script src="_magpie/bridge.js">` → 面板连 options 都读不到，一片死白。
// 这三条都只能靠形状检查，所以锁在这里。
//
// 契约出处：magpie 源码 docs/subsystems/plugin-runtime.md 的 P5
//   magpie.panels: [{ slot, file, title }]，slot ∈ {agents, usage, settings, provider}；
//   file 必须是 plugin 文件夹里的 .html；面板通过 _magpie/bridge.js 的
//   magpie.options.get() / .set(obj) 读写**本插件自己的**选项。

import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
const panels = pkg.magpie?.panels ?? []
const SLOTS = new Set(["agents", "usage", "settings", "provider"])

test("magpie.panels 最起码有一个，形状是 {slot, file, title}", () => {
  assert.ok(Array.isArray(panels) && panels.length > 0, "面板清单不能空 —— 空数组等于没声明")
  assert.ok(panels.length <= 8, "magpie 一个插件最多 8 个面板（maxPanels）")
  for (const p of panels) {
    assert.ok(SLOTS.has(p.slot), `slot 必须是 ${[...SLOTS].join(" / ")} 之一，收到 ${p.slot}`)
    assert.ok(typeof p.title === "string" && p.title.trim(), "每个面板要有 title（没有它标题是空的）")
    assert.ok(typeof p.file === "string" && p.file.endsWith(".html"), "file 必须是 .html")
    assert.ok(existsSync(join(ROOT, p.file)), `面板文件不存在：${p.file}`)
  }
})

test("面板文件必须在 npm 的 files 白名单里（否则装出来是空白）", () => {
  const files = pkg.files ?? []
  for (const p of panels) {
    const top = p.file.split("/")[0]
    assert.ok(
      files.includes(top) || files.includes(p.file),
      `files 白名单里没有 ${top} —— npm 打包会漏掉面板文件，用户那边就是一块空白`,
    )
  }
})

test("provider 槽的面板必须用 bridge 读写选项，不能自己造消息", () => {
  const provider = panels.find((p) => p.slot === "provider")
  assert.ok(provider, "provider 槽的面板是本次需求的落点（provider 编辑器里加选项 UI）")
  const html = readFileSync(join(ROOT, provider.file), "utf8")
  assert.match(html, /_magpie\/bridge\.js/, "必须加载 magpie 的 bridge，否则拿不到 options")
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  assert.ok(scripts.length > 0, "面板要有自己的脚本")
  const own = scripts.find((s) => !s.includes("_magpie/"))
  assert.ok(own, "面板要有自己的 JS 文件")
  const js = readFileSync(join(dirname(join(ROOT, provider.file)), own), "utf8")
  assert.match(js, /magpie\.options\.get\(\)/, "要读当前选项（否则面板打开是空的）")
  assert.match(js, /magpie\.options\.set\(/, "要能写选项，否则改了不生效")
  for (const mode of ["off", "blocked", "always"]) {
    assert.match(js, new RegExp(`["']${mode}["']`), `面板要覆盖 ${mode} 这一档`)
  }
  assert.match(js, /firstLine/, "写回的是 loader 读的那个字段 firstLine")
})

test("面板写回时保留别的选项键（整份替换的下标坑）", () => {
  const provider = panels.find((p) => p.slot === "provider")
  const html = readFileSync(join(ROOT, provider.file), "utf8")
  const own = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).find((s) => !s.includes("_magpie/"))
  const js = readFileSync(join(dirname(join(ROOT, provider.file)), own), "utf8")
  // options.set 是整份替换：只要写成 {firstLine:{…}} 就会把其它键抹掉
  assert.match(js, /\.\.\.opts/, "写回必须展开读到的整份 opts")
})
