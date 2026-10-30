const BASE = "https://services.leadconnectorhq.com";

function headers() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: "2021-04-15",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function ghl<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`GHL ${init.method || "GET"} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : ({} as T);
}

export interface ChatMessage {
  direction: "inbound" | "outbound";
  body: string;
  attachments: string[];
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp)(\?|$)/i;

export async function findConversationId(contactId: string, locationId: string): Promise<string | null> {
  const r = await ghl(`/conversations/search?locationId=${locationId}&contactId=${contactId}`);
  return r.conversations?.[0]?.id ?? null;
}

/** Full SMS history, oldest first. GHL is the source of truth, so the bot needs no database. */
export async function getTranscript(conversationId: string): Promise<ChatMessage[]> {
  const r = await ghl(`/conversations/${conversationId}/messages?limit=60`);
  const raw: any[] = r.messages?.messages ?? r.messages ?? [];
  return raw
    .filter((m) => typeof m.body === "string" || m.attachments?.length)
    .map((m) => ({
      direction: m.direction === "inbound" ? "inbound" : "outbound",
      body: (m.body ?? "").trim(),
      attachments: ((m.attachments ?? []) as string[]).filter((u) => IMAGE_RE.test(u)),
      at: m.dateAdded as string,
    }))
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map(({ at, ...rest }) => rest as ChatMessage);
}

export async function sendSms(contactId: string, message: string) {
  return ghl("/conversations/messages", {
    method: "POST",
    body: JSON.stringify({ type: "SMS", contactId, message }),
  });
}

export async function addNote(contactId: string, body: string) {
  return ghl(`/contacts/${contactId}/notes`, { method: "POST", body: JSON.stringify({ body }) });
}

export async function addTags(contactId: string, tags: string[]) {
  return ghl(`/contacts/${contactId}/tags`, { method: "POST", body: JSON.stringify({ tags }) });
}

export async function getContact(contactId: string) {
  const r = await ghl(`/contacts/${contactId}`);
  return r.contact as { firstName?: string; tags?: string[]; locationId?: string };
}

/** Returns up to `max` upcoming slots as ISO strings. */
export async function getFreeSlots(calendarId: string, days: number, tz: string, max = 6): Promise<string[]> {
  const start = Date.now();
  const end = start + days * 86_400_000;
  const r = await ghl(
    `/calendars/${calendarId}/free-slots?startDate=${start}&endDate=${end}&timezone=${encodeURIComponent(tz)}`,
  );
  const slots: string[] = [];
  for (const [key, val] of Object.entries<any>(r)) {
    if (key === "traceId") continue;
    slots.push(...(val?.slots ?? []));
  }
  return slots.sort().slice(0, max);
}

export async function bookAppointment(opts: {
  calendarId: string;
  locationId: string;
  contactId: string;
  startTime: string;
  title: string;
  notes: string;
}) {
  return ghl("/calendars/events/appointments", {
    method: "POST",
    body: JSON.stringify({
      calendarId: opts.calendarId,
      locationId: opts.locationId,
      contactId: opts.contactId,
      startTime: opts.startTime,
      title: opts.title,
      appointmentStatus: "confirmed",
      address: "",
      ignoreDateRange: false,
      toNotify: true,
      description: opts.notes,
    }),
  });
}
