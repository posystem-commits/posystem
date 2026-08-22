import { NextResponse } from "next/server";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

// Proxies the in-app help chatbot to the Claude API. The original prototype (src/pos.jsx) called
// api.anthropic.com directly from the browser — that only ever worked inside the Claude-artifact
// sandbox, which injects the auth for you. A real deployment needs a server-side API key (never
// shippable to the browser) and a real backend to hold it, which is exactly what this route is:
// a thin, tenant-gated pass-through. sendHelpMessage() in pos.jsx posts { system, messages } here
// instead of straight to Anthropic; the model id is fixed server-side rather than trusted from
// the client.
export async function POST(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Help chat isn't configured on this server yet." }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.system || !Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "Body must be { system, messages }" }, { status: 400 });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 600,
      system: body.system,
      messages: body.messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json({ error: `Anthropic API error: ${response.status} ${detail}` }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
