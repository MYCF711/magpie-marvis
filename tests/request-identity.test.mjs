import test from "node:test"
import assert from "node:assert/strict"
import { requestIdentity } from "../src/marvis/protocol.mjs"

test("requestIdentity 把同一组 id 写进 bus_info", () => {
  const id = requestIdentity(
    { openid: "openid-1", loginType: "2" },
    { model: "main-auto", nonce: "nonce-1", conversationId: "conv_abc", responseId: "resp_def" },
  )
  assert.equal(id.agentTag, "main")
  assert.equal(id.scene, "agent_chat")
  assert.equal(id.loginType, "2")
  assert.match(id.busInfo, /marvisConversationID=conv_abc/)
  assert.match(id.busInfo, /marvisResponseID=resp_def/)
  assert.match(id.busInfo, /model=main-auto/)
  assert.match(id.busInfo, /nonce=nonce-1/)
  assert.match(id.busInfo, /originOpenID=openid-1/)
})
