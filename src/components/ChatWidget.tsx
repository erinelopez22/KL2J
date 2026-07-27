import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ArrowLeft, Facebook, Phone, Mail } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitInquiry } from "@/lib/inquiries.functions";
import logoAsset from "@/assets/kl2j-logo.jpg.asset.json";

const FB_PAGE_ID = "61581147040190";
const MESSENGER_URL = `https://m.me/${FB_PAGE_ID}`;
const SMART_NUMBER = "09296410776";
const GLOBE_NUMBER = "09954608248";
const STAFF_EMAIL = "erinelopez22@gmail.com";
// PH E.164 for wa.me / viber (drop leading 0, prefix 63)
const WA_NUMBER = "639296410776";
const VIBER_NUMBER = "639296410776";

const SERVICES = [
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
  { id: "estimate", label: "Get a price estimate" },
  { id: "surveyor", label: "Talk to a surveyor" },
  { id: "requirements", label: "Ask about requirements" },
  { id: "schedule", label: "Schedule a site visit" },
];

type Msg = { from: "bot" | "user"; text: string; options?: { label: string; value: string }[] };
type Step = "intro" | "service" | "intent" | "details" | "channel" | "done";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [service, setService] = useState<string>("");
  const [intent, setIntent] = useState<string>("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendInquiry = useServerFn(submitInquiry);

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

  function chooseService(s: string) {
    setService(s);
    pushUser(s);
    pushBot("Got it. How can we help you today?");
    setStep("intent");
  }

  function chooseIntent(i: { id: string; label: string }) {
    setIntent(i.label);
    pushUser(i.label);
    pushBot(
      "Please share your name and a contact number or email so our team can follow up. You can also add any details about your property (location, lot size, etc.).",
    );
    setStep("details");
  }

  async function submitDetails() {
    if (!name.trim() || !contact.trim()) return;
    setSubmitting(true);
    pushUser(`${name} · ${contact}${note ? " · " + note : ""}`);
    try {
      await sendInquiry({
        data: {
          name: name.trim(),
          contact: contact.trim(),
          service,
          message: `${intent}${note ? "\n\n" + note : ""}`,
          status: "new",
        },
      });
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
    pushBot(
      "Thank you! Your inquiry has been sent to our team. For a faster reply, you can also reach us directly on any of these channels:",
    );
    setStep("channel");
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
        contact: contact.trim() || channel,
        service,
        message: `Handoff → ${channel}\n${intent}${note ? "\n" + note : ""}`,
        channel,
        status: "handoff",
      },
    }).catch((e) => console.error(e));
    window.open(url, "_blank", "noopener,noreferrer");
    setStep("done");
    pushBot(`Opening ${channel === "call" ? "phone dialer" : channel}… We'll continue there.`);
  }

  function reset() {
    setMessages([]);
    setStep("intro");
    setService("");
    setIntent("");
    setName("");
    setContact("");
    setNote("");
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
              src={logoAsset.url}
              alt="KL2J"
              className="h-9 w-9 rounded-full border border-primary-foreground/30 bg-white object-cover"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold leading-tight">KL2J Assistant</div>
              <div className="text-xs opacity-80">Typically replies within business hours</div>
            </div>
            {step !== "intro" && step !== "service" && (
              <button
                onClick={reset}
                className="rounded p-1 hover:bg-primary-foreground/10"
                aria-label="Restart"
                title="Start over"
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
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
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
            <div className="space-y-2 border-t border-border bg-card p-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or email"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Property location, lot size, or any details (optional)"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                disabled={!name.trim() || !contact.trim() || submitting}
                onClick={submitDetails}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
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
