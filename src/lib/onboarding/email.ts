import OnboardingEmailEvent from "@/lib/models/onboarding/email-event";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  bodyHtml: string;
  template?: string;
  payload?: Record<string, unknown>;
  clientId?: string;
  triggeredBy?: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: "resend" | "mock";
  providerId?: string;
  error?: string;
  eventId: string;
}

const FROM = process.env.ONBOARDING_EMAIL_FROM || "noreply@thyleads.com";

// One sender for the whole flow. Resend if RESEND_API_KEY is set; otherwise
// mock-mode logs the would-be email to console + writes an EmailEvent row.
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const apiKey = process.env.RESEND_API_KEY;

  const event = await OnboardingEmailEvent.create({
    to,
    from: FROM,
    subject: input.subject,
    template: input.template || "",
    payload: input.payload || {},
    bodyHtml: input.bodyHtml,
    provider: apiKey ? "resend" : "mock",
    status: "queued",
    clientId: input.clientId || "",
    triggeredBy: input.triggeredBy || "",
  });
  const eventId = String(event._id);

  if (!apiKey) {
    await OnboardingEmailEvent.findByIdAndUpdate(eventId, {
      status: "sent",
      sentAt: new Date(),
      providerId: `mock-${eventId}`,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[onboarding email:mock] to=${to.join(",")} subject="${input.subject}" eventId=${eventId}`);
    }
    return { ok: true, provider: "mock", providerId: `mock-${eventId}`, eventId };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ from: FROM, to, subject: input.subject, html: input.bodyHtml }),
    });
    if (!res.ok) {
      const errText = await res.text();
      await OnboardingEmailEvent.findByIdAndUpdate(eventId, { status: "failed", error: errText });
      return { ok: false, provider: "resend", error: errText, eventId };
    }
    const data = (await res.json()) as { id?: string };
    await OnboardingEmailEvent.findByIdAndUpdate(eventId, {
      status: "sent",
      sentAt: new Date(),
      providerId: data.id || "",
    });
    return { ok: true, provider: "resend", providerId: data.id, eventId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    await OnboardingEmailEvent.findByIdAndUpdate(eventId, { status: "failed", error: message });
    return { ok: false, provider: "resend", error: message, eventId };
  }
}
