import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, X, Send, ArrowLeft, Facebook, Phone, Mail } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitInquiry } from "@/lib/inquiries.functions";
import { usePublicServices, usePublicSiteSettings } from "@/lib/public-content";
import { LocationAutosuggest } from "@/components/LocationAutosuggest";
import { PublicDocumentUpload, type UploadedDocument } from "@/components/PublicDocumentUpload";
import { splitAreaAnswer, joinAreaAnswer } from "@/lib/areaUnit";
import { YesNoToggle } from "@/components/YesNoToggle";
import logoUrl from "@/assets/kl2j-logo.jpg";

type ChecklistAnswer = {
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: UploadedDocument[];
};

const FB_PAGE_ID = "61581147040190";
const MESSENGER_URL = `https://m.me/${FB_PAGE_ID}`;
const SMART_NUMBER = "09296410776";
const GLOBE_NUMBER = "09954608248";
const STAFF_EMAIL = "erinelopez22@gmail.com";
// PH E.164 for wa.me / viber (drop leading 0, prefix 63)
const WA_NUMBER = "639296410776";
const VIBER_NUMBER = "639296410776";

const FALLBACK_SERVICES = [
  "Relocation Survey",
  "Subdivision Survey",
  "Consolidation Survey",
  "Topographic Survey",
  "Consolidation-Subdivision Survey",
  "Verification Survey",
  "As-Built Survey",
  "Land Titling Assistance",
  "Other / Not sure",
];

const INTENTS = [
  { id: "send_inquiry", label: "Send Inquiry" },
  { id: "requirements", label: "Ask about requirements" },
];

type Msg = { from: "bot" | "user"; text: string; options?: { label: string; value: string }[] };
type Step = "intro" | "service" | "intent" | "details" | "channel" | "done";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [stepHistory, setStepHistory] = useState<Step[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [service, setService] = useState<string>("");
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, ChecklistAnswer>>({});
  const [intent, setIntent] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendInquiry = useServerFn(submitInquiry);
  const { data: servicesData } = usePublicServices();
  const { data: siteSettings } = usePublicSiteSettings();
  const logo = siteSettings?.logo_url || logoUrl;
  const SERVICES =
    servicesData && servicesData.length > 0
      ? [...servicesData.map((s) => s.title), "Other / Not sure"]
      : FALLBACK_SERVICES;
  const serviceChecklist = servicesData?.find((s) => s.title === service)?.checklist ?? [];

  useEffect(() => {
    if (open && messages.length === 0) {
      pushBot(
        "Hi! I'm the KL2J assistant 👋 I can help route your inquiry to the right person. What service are you interested in?",
      );
      setStep("service");
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, step]);

  function pushBot(text: string, options?: Msg["options"]) {
    setMessages((m) => [...m, { from: "bot", text, options }]);
  }
  function pushUser(text: string) {
    setMessages((m) => [...m, { from: "user", text }]);
  }

  function goToStep(next: Step) {
    setStepHistory((h) => [...h, step]);
    setStep(next);
  }

  function goBack() {
    setStepHistory((h) => {
      if (h.length === 0) return h;
      setStep(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  function chooseService(s: string) {
    setService(s);
    setChecklistAnswers({});
    pushUser(s);
    pushBot("Got it. How can we help you today?");
    goToStep("intent");
  }

  function updateChecklistAnswer(id: string, patch: ChecklistAnswer) {
    setChecklistAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  }

  function describeRequirements(): string {
    if (serviceChecklist.length === 0) {
      return "For this service we just need your contact details and a short description of what you need — no specific documents required upfront.";
    }
    const lines = serviceChecklist.map((item) => {
      if (item.type === "number" && item.unit) return `• ${item.label} (${item.unit})`;
      if (item.type === "document")
        return `• ${item.label} (you can confirm you have it without uploading, if you prefer)`;
      return `• ${item.label}`;
    });
    return `Here's what we'll typically need for ${service}:\n${lines.join("\n")}`;
  }

  function chooseIntent(i: { id: string; label: string }) {
    setIntent(i.label);
    pushUser(i.label);
    if (i.id === "requirements") {
      pushBot(describeRequirements());
      pushBot("Would you like to send an inquiry now?");
      return;
    }
    pushBot(
      serviceChecklist.length > 0
        ? "Please share your name and a contact number or email so our team can follow up, plus a few quick details for this service below."
        : "Please share your name and a contact number or email so our team can follow up. You can also add any details about your property (location, lot size, etc.).",
    );
    goToStep("details");
  }

  function buildChecklistResponses() {
    return serviceChecklist.map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
      checked: checklistAnswers[item.id]?.checked,
      answer: checklistAnswers[item.id]?.answer,
      hasDocument: checklistAnswers[item.id]?.hasDocument ?? false,
      documents: checklistAnswers[item.id]?.documents ?? [],
    }));
  }

  function detailsValid(): boolean {
    if (!name.trim() || !email.trim() || !phone.trim() || !note.trim()) return false;
    return serviceChecklist.every((item) => {
      if (item.type === "document") return true;
      const a = checklistAnswers[item.id];
      if (item.type === "checkbox") return a?.checked !== undefined;
      return Boolean(a?.answer?.trim());
    });
  }

  async function submitDetails() {
    if (!detailsValid()) return;
    setSubmitting(true);
    const contactSummary = [email.trim(), phone.trim()].filter(Boolean).join(" · ");
    pushUser(`${name} · ${contactSummary}${note ? " · " + note : ""}`);
    let inquiryCode: string | null = null;
    try {
      const result = await sendInquiry({
        data: {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          service,
          message: `${intent}${note ? "\n\n" + note : ""}`,
          channel: "chatbot",
          checklist_responses: buildChecklistResponses(),
          status: "New",
        },
      });
      inquiryCode = result.inquiryCode;
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
    setSubmittedCode(inquiryCode);
    if (inquiryCode) {
      pushBot(
        `Thank you! Your inquiry has been sent to our team. Your inquiry code is ${inquiryCode} — we've also emailed it to you.`,
      );
      pushBot(
        `Here's how to use your code:\n1. Tap "View My Inquiries" below.\n2. Your inquiry loads automatically using this code.\n3. Check your status or message us anytime from there.\n\nFor a faster reply, you can also reach us directly on any of these channels:`,
      );
    } else {
      pushBot(
        "Thank you! Your inquiry has been sent to our team. For a faster reply, you can also reach us directly on any of these channels:",
      );
    }
    goToStep("channel");
  }

  function prefilledMessage() {
    return `Hi KL2J, I'm ${name || "an inquirer"} interested in ${service || "your services"}. ${intent || ""}${
      note ? "\n\nDetails: " + note : ""
    }`.trim();
  }

  function handoff(channel: "messenger" | "whatsapp" | "viber" | "call" | "email") {
    const text = encodeURIComponent(prefilledMessage());
    let url = "";
    if (channel === "messenger") url = MESSENGER_URL;
    else if (channel === "whatsapp") url = `https://wa.me/${WA_NUMBER}?text=${text}`;
    else if (channel === "viber") url = `viber://chat?number=%2B${VIBER_NUMBER}&draft=${text}`;
    else if (channel === "call") url = `tel:${SMART_NUMBER}`;
    else if (channel === "email")
      url = `mailto:${STAFF_EMAIL}?subject=${encodeURIComponent(
        `Inquiry: ${service || "KL2J Services"}`,
      )}&body=${text}`;
    // fire-and-forget log + email notification
    sendInquiry({
      data: {
        name: name.trim() || "Anonymous",
        email: email.trim() || null,
        phone: phone.trim() || (email.trim() ? null : channel),
        service,
        message: `Handoff → ${channel}\n${intent}${note ? "\n" + note : ""}`,
        channel,
        checklist_responses: buildChecklistResponses(),
        status: "New",
      },
    }).catch((e) => console.error(e));
    window.open(url, "_blank", "noopener,noreferrer");
    goToStep("done");
    pushBot(`Opening ${channel === "call" ? "phone dialer" : channel}… We'll continue there.`);
  }

  function reset() {
    setMessages([]);
    setStep("intro");
    setStepHistory([]);
    setService("");
    setChecklistAnswers({});
    setIntent("");
    setName("");
    setEmail("");
    setPhone("");
    setNote("");
    setSubmittedCode(null);
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-2xl transition hover:scale-105 hover:shadow-primary/40"
          aria-label="Open chat"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">Chat with us</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-primary p-3 text-primary-foreground">
            <img
              src={logo}
              alt="KL2J"
              className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-white object-cover"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold leading-tight">KL2J Assistant</div>
              <div className="text-xs opacity-80">Typically replies within business hours</div>
            </div>
            {stepHistory.length > 0 && (
              <button
                onClick={goBack}
                className="rounded p-1 hover:bg-primary-foreground/10"
                aria-label="Go back"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-primary-foreground/10"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.from === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground border border-border"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Inline pickers */}
            {step === "service" && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SERVICES.map((s) => (
                  <button
                    key={s}
                    onClick={() => chooseService(s)}
                    className="rounded-full border border-primary/30 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary hover:bg-primary/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {step === "intent" && (
              <div className="flex flex-col gap-2 pt-1">
                {INTENTS.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => chooseIntent(i)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary/5"
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            )}

            {step === "channel" && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {submittedCode && (
                  <Link
                    to="/my-inquiries"
                    search={{ code: submittedCode }}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    View My Inquiries
                  </Link>
                )}
                <button
                  onClick={() => handoff("messenger")}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#0084ff] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Facebook className="h-4 w-4" /> Messenger
                </button>
                <button
                  onClick={() => handoff("whatsapp")}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.3L2 22l4.8-1.5c1.5.8 3.3 1.3 5.2 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={() => handoff("viber")}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#7360F2] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <MessageCircle className="h-4 w-4" /> Viber
                </button>
                <button
                  onClick={() => handoff("call")}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Phone className="h-4 w-4" /> Call
                </button>
                <button
                  onClick={() => handoff("email")}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground hover:bg-primary/10"
                >
                  <Mail className="h-4 w-4" /> Email {STAFF_EMAIL}
                </button>
                <div className="col-span-2 mt-1 text-center text-[11px] text-muted-foreground">
                  Smart {SMART_NUMBER} · Globe {GLOBE_NUMBER}
                </div>
              </div>
            )}

            {step === "done" && (
              <div className="pt-1">
                <button
                  onClick={reset}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  Start a new inquiry
                </button>
              </div>
            )}
          </div>

          {/* Details form */}
          {step === "details" && (
            <div className="border-t border-border bg-card p-3">
              <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-destructive">*</span> required (file uploads excepted)
                </p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name *"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email *"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone *"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>

                {serviceChecklist.length > 0 && (
                  <div className="space-y-2.5 rounded-lg border border-border bg-background/60 p-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      A few quick details for this service
                    </p>
                    {serviceChecklist.map((item) => {
                      const a = checklistAnswers[item.id] ?? {};
                      if (item.type === "checkbox") {
                        return (
                          <div key={item.id}>
                            <span className="mb-1 block text-xs text-muted-foreground">
                              {item.label} *
                            </span>
                            <YesNoToggle
                              value={a.checked}
                              onChange={(checked) => updateChecklistAnswer(item.id, { checked })}
                            />
                          </div>
                        );
                      }
                      if (item.type === "document") {
                        return (
                          <PublicDocumentUpload
                            key={item.id}
                            label={item.label}
                            value={{
                              hasDocument: Boolean(a.hasDocument),
                              documents: a.documents ?? [],
                            }}
                            onChange={(next) => updateChecklistAnswer(item.id, next)}
                          />
                        );
                      }
                      if (item.type === "location") {
                        return (
                          <div key={item.id}>
                            <span className="mb-1 block text-xs text-muted-foreground">
                              {item.label} *
                            </span>
                            <LocationAutosuggest
                              value={a.answer ?? ""}
                              onChange={(v) => updateChecklistAnswer(item.id, { answer: v })}
                            />
                          </div>
                        );
                      }
                      if (item.type === "number" && item.unit === "sqm") {
                        const { value: areaValue, unit: areaUnit } = splitAreaAnswer(a.answer);
                        return (
                          <div key={item.id}>
                            <span className="mb-1 block text-xs text-muted-foreground">
                              {item.label} *
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={areaValue}
                                onChange={(e) =>
                                  updateChecklistAnswer(item.id, {
                                    answer: joinAreaAnswer(e.target.value, areaUnit),
                                  })
                                }
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                              />
                              <select
                                value={areaUnit}
                                onChange={(e) =>
                                  updateChecklistAnswer(item.id, {
                                    answer: joinAreaAnswer(
                                      areaValue,
                                      e.target.value as "sqm" | "hectares",
                                    ),
                                  })
                                }
                                className="h-9 shrink-0 rounded-md border border-border bg-background px-2 text-xs"
                              >
                                <option value="sqm">sqm</option>
                                <option value="hectares">hectares</option>
                              </select>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={item.id}>
                          <span className="mb-1 block text-xs text-muted-foreground">
                            {item.label} *
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type={item.type === "number" ? "number" : "text"}
                              value={a.answer ?? ""}
                              onChange={(e) =>
                                updateChecklistAnswer(item.id, { answer: e.target.value })
                              }
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                            />
                            {item.unit && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Property location, lot size, or any details *"
                  rows={2}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <button
                disabled={!detailsValid() || submitting}
                onClick={submitDetails}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Sending…" : "Send inquiry"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
