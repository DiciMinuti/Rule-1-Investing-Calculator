import { factPacketJsonSchema, qualitativeBriefJsonSchema } from "./schema.mjs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ZAI_CHAT_COMPLETIONS_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const OPENAI_TIMEOUT_MS = 300_000;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function collectOutputText(responseBody) {
  if (typeof responseBody.output_text === "string") {
    return responseBody.output_text;
  }

  const chunks = [];
  for (const item of responseBody.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function parseJsonObjectText(text, providerName) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch (error) {
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
    }

    throw new Error(`${providerName} response was not valid JSON: ${error.message}`);
  }
}

function buildInput(packet) {
  return [
    {
      role: "system",
      content:
        "You write concise Rule #1 investor research briefs. Use only the provided fact packet. Do not invent numbers, dates, leaders, products, customers, margins, market shares, tenure, communication habits, governance practices, or regulatory issues. If the packet does not support a moat type, omit it. Prefer specific facts over broad praise. Every summary and point should sound like it could only apply to this company. Avoid vague claims such as transparent, ethical, continuously monitored, loyal customers, market dominance, or strong brand unless the packet states the supporting fact.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Create a qualitative management and moat brief for this business.",
          generatedAt: todayIsoDate(),
          writingRules: [
            "Keep the UI copy simple and useful for an investor.",
            "Write richer descriptions than the previous short version: management summaries and moat summaries should usually be two sentences, roughly 45-70 words.",
            "Management bullet points should be concrete explanatory points, roughly 20-35 words each, not fragments.",
            "Management sections must be exactly: Leadership, Capital Allocation, Shareholder Alignment, Communication, Governance.",
            "Use named executives, financial figures, capital returns, compensation structure, board oversight, operating risks, segment data, and business-model facts where the packet supports them.",
            "Every management section must include at least two concrete points.",
            "For Communication, discuss exact disclosure practices, filings, earnings releases, segment reporting, operating metrics, or investor reporting facts in the packet; do not claim transparency as a personality trait.",
            "For Governance, discuss board oversight, ownership, compensation structure, shareholder-interest language, and named risk factors; do not claim practices not stated in the packet.",
            "Moat types should be specific to the business and should not be forced.",
            "Every moat summary must include at least one concrete company fact, number, product family, service category, installed-base fact, margin fact, revenue fact, customer fact, scale fact, or regulatory fact.",
            "Every point should teach the reader something concrete about this company.",
            "Use grades strong, middle, or dull.",
          ],
          packet,
        },
        null,
        2,
      ),
    },
  ];
}

function buildZaiBriefMessages(packet) {
  const messages = buildInput(packet);
  const userMessage = messages.find((message) => message.role === "user");

  return messages.map((message) => {
    if (message !== userMessage) {
      return message;
    }

    return {
      ...message,
      content: `${message.content}\n\nReturn only valid JSON matching this JSON Schema:\n${JSON.stringify(
        qualitativeBriefJsonSchema,
        null,
        2,
      )}`,
    };
  });
}

function buildFactPacketInput({ symbol, companyName, sources }) {
  return [
    {
      role: "system",
      content:
        "You extract investor-useful fact packets from public company source text. Use only the supplied source material. Do not infer unsupported numbers, dates, executives, margins, ownership, products, customers, or business lines. Prefer facts that will later help judge management quality and moat strength.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Build a source-grounded qualitative fact packet for later moat and management generation.",
          symbol,
          companyName,
          updatedAt: todayIsoDate(),
          extractionRules: [
            "Return 14-24 facts if enough source material is available.",
            "Include business model, product or service lines, revenue scale, segment/category facts, margins or cash-flow facts, capital allocation, management names, compensation/governance facts, and risk factors when present.",
            "Each fact statement must be concrete and company-specific.",
            "Every source field must name the source document or URL supplied in the source material.",
            "Do not add any fact that is not directly supported by the source material.",
          ],
          sources,
        },
        null,
        2,
      ),
    },
  ];
}

function buildZaiFactPacketMessages({ symbol, companyName, sources }) {
  const messages = buildFactPacketInput({ symbol, companyName, sources });
  const userMessage = messages.find((message) => message.role === "user");

  return messages.map((message) => {
    if (message !== userMessage) {
      return message;
    }

    return {
      ...message,
      content: `${message.content}\n\nReturn only valid JSON matching this JSON Schema:\n${JSON.stringify(
        factPacketJsonSchema,
        null,
        2,
      )}`,
    };
  });
}

export async function generateQualitativeBriefWithOpenAI({
  packet,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_BRIEF_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5",
}) {
  if ((process.env.OPENAI_BRIEF_PROVIDER ?? "openai").toLowerCase() === "zai") {
    return generateQualitativeBriefWithZai({ packet });
  }

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate a qualitative brief.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: buildInput(packet),
      text: {
        format: {
          type: "json_schema",
          name: "qualitative_brief",
          strict: true,
          schema: qualitativeBriefJsonSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const outputText = collectOutputText(body);
  if (!outputText) {
    throw new Error(`OpenAI response did not include output text: ${JSON.stringify(body)}`);
  }

  return JSON.parse(outputText);
}

export async function generateQualitativeBriefWithZai({
  packet,
  apiKey = process.env.ZAI_API_KEY,
  model = process.env.ZAI_BRIEF_MODEL ?? process.env.ZAI_FACT_MODEL ?? "glm-5.2",
}) {
  if (!apiKey) {
    throw new Error("ZAI_API_KEY is required when OPENAI_BRIEF_PROVIDER=zai.");
  }

  const response = await fetch(ZAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildZaiBriefMessages(packet),
      stream: false,
      temperature: 0,
      max_tokens: 12_000,
      response_format: {
        type: "json_object",
      },
      thinking: {
        type: "disabled",
      },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Z.ai request failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const outputText = body.choices?.[0]?.message?.content;
  if (typeof outputText !== "string" || !outputText.trim()) {
    throw new Error(`Z.ai response did not include message content: ${JSON.stringify(body)}`);
  }

  return parseJsonObjectText(outputText, "Z.ai");
}

export async function generateFactPacketWithOpenAI({
  symbol,
  companyName,
  sources,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_FACT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
}) {
  if ((process.env.OPENAI_FACT_PROVIDER ?? "openai").toLowerCase() === "zai") {
    return generateFactPacketWithZai({ symbol, companyName, sources });
  }

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate a fact packet.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: buildFactPacketInput({ symbol, companyName, sources }),
      text: {
        format: {
          type: "json_schema",
          name: "qualitative_fact_packet",
          strict: true,
          schema: factPacketJsonSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const outputText = collectOutputText(body);
  if (!outputText) {
    throw new Error(`OpenAI response did not include output text: ${JSON.stringify(body)}`);
  }

  return JSON.parse(outputText);
}

export async function generateFactPacketWithZai({
  symbol,
  companyName,
  sources,
  apiKey = process.env.ZAI_API_KEY,
  model = process.env.ZAI_FACT_MODEL ?? "glm-5.2",
}) {
  if (!apiKey) {
    throw new Error("ZAI_API_KEY is required when OPENAI_FACT_PROVIDER=zai.");
  }

  const response = await fetch(ZAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildZaiFactPacketMessages({ symbol, companyName, sources }),
      stream: false,
      temperature: 0,
      max_tokens: 12_000,
      response_format: {
        type: "json_object",
      },
      thinking: {
        type: "disabled",
      },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Z.ai request failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const outputText = body.choices?.[0]?.message?.content;
  if (typeof outputText !== "string" || !outputText.trim()) {
    throw new Error(`Z.ai response did not include message content: ${JSON.stringify(body)}`);
  }

  return parseJsonObjectText(outputText, "Z.ai");
}
