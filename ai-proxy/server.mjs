import express from "express";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // zet via export
const OPENAI_BASE = process.env.OPENAI_BASE ?? "https://api.openai.com";
const PORT = process.env.PORT ?? 8787;

// Ruwe token schatter (4 chars ≈ 1 token)
function roughTokens(str) { return Math.ceil((str || "").length / 4); }
function countMessagesTokens(messages) {
  return (messages || []).reduce((s, m) => s + roughTokens(`${m.role||""}${m.name||""}${m.content||""}`), 0);
}

async function callOpenAI(payload) {
  const r = await fetch(`${OPENAI_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const txt = await r.text();
    const err = new Error(`Upstream error: ${r.status} ${txt}`);
    err.status = r.status; err.raw = txt;
    throw err;
  }
  return r.json();
}

async function summarizeConversation(messages, model) {
  const sys = {
    role: "system",
    content: "Summarize the prior conversation into crisp bullet points (~250 tokens). Keep constraints, decisions, code pointers, and TODOs. Be neutral."
  };
  const user = { role: "user", content: JSON.stringify(messages) };
  const r = await fetch(`${OPENAI_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [sys, user], temperature: 0.2 })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Summarize failed: ${r.status} ${t}`);
  }
  const d = await r.json();
  return d?.choices?.[0]?.message?.content ?? "Summary unavailable.";
}

const app = express();
app.use(express.json({ limit: "5mb" }));

app.post("/v1/chat/completions", async (req, res) => {
  const { model, messages, ...rest } = req.body || {};
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: { message: "OPENAI_API_KEY is not set." }});
  }
  try {
    // 1) Eerste poging
    try {
      const data = await callOpenAI({ model, messages, ...rest });
      return res.json(data);
    } catch (e) {
      const raw = `${e.raw || ""}`.toLowerCase();
      const overflow =
        raw.includes("maximum context length") ||
        raw.includes("context length exceeded") ||
        raw.includes("out of memory") ||
        raw.includes("ran out of room in the model's context window") ||
        e.status === 400;

      if (!overflow) throw e;

      // 2) Compress + retry
      const systemMsgs = (messages || []).filter(m => m.role === "system");
      const nonSystem = (messages || []).filter(m => m.role !== "system");
      const recentTail = nonSystem.slice(-6);

      const summary = await summarizeConversation(nonSystem, rest.model ?? model);
      let finalMsgs = [
        ...systemMsgs,
        { role: "system", content: "Compressed history:\n" + summary },
        ...recentTail
      ];

      let guard = 0;
      while (countMessagesTokens(finalMsgs) > 120000 && guard < 3) {
        finalMsgs = [
          ...systemMsgs.slice(0,1),
          { role: "system", content: "Compressed history (extra-trim):\n" + summary },
          ...recentTail.slice(-3)
        ];
        guard++;
      }

      const retried = await callOpenAI({ model, messages: finalMsgs, ...rest });
      return res.json(retried);
    }
  } catch (err) {
    return res.status(500).json({ error: { message: err?.message || "Proxy error", type: "proxy_error" }});
  }
});

app.get("/v1/models", async (_req, res) => {
  try {
    const r = await fetch(`${OPENAI_BASE}/v1/models`, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    });
    const j = await r.json();
    res.json(j);
  } catch {
    res.json({ data: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Auto-reset proxy running on http://localhost:${PORT}/v1`);
});
