import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { submitInquiry } from "@/lib/inquiries.functions";
import {
  Compass,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  Ruler,
  Landmark,
  Building2,
  Mountain,
  Layers,
  Split,
  Combine,
  FileCheck2,
  BadgeCheck,
  Clock,
  Award,
  Facebook,
  FileText,
  ExternalLink,
  X,
  Maximize2,
  Handshake,
  Play,
  Star,
} from "lucide-react";
import { ChatWidget } from "@/components/ChatWidget";
import {
  usePublicServices,
  usePublicGalleryPhotos,
  usePublicDocuments,
  usePublicProjects,
  usePublicSiteSettings,
  usePublicPartnerCompanies,
  usePublicReviews,
  type PublicReview,
  type PublicAttachment,
} from "@/lib/public-content";
import { LocationAutosuggest } from "@/components/LocationAutosuggest";
import { PublicDocumentUpload, type UploadedDocument } from "@/components/PublicDocumentUpload";
import { getServiceIcon } from "@/lib/admin/iconMap";
import { splitAreaAnswer, joinAreaAnswer } from "@/lib/areaUnit";
import { WriteReviewModal } from "@/components/WriteReviewModal";
import { AttachmentLightbox, type LightboxItem } from "@/components/AttachmentLightbox";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { YesNoToggle } from "@/components/YesNoToggle";

const FACEBOOK_PAGE_URL = "https://www.facebook.com/profile.php?id=61581147040190";
const FACEBOOK_DOCS_URL =
  "https://www.facebook.com/permalink.php?story_fbid=pfbid0pDhu8X7Zwkpwrpti3ccFEXWoHni2X6X8bip1Lo9DaoCJFZLX9oDkxifCbhfxDnM6l&id=61581147040190";
import logoUrl from "@/assets/kl2j-logo.jpg";
import bannerUrl from "@/assets/kl2j-bg.png";
import prcUrl from "@/assets/kl2j-prc-licensed.jpg";
import secUrl from "@/assets/kl2j-sec-registered.jpg";
const heroImage = bannerUrl;

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => ({
    meta: [
      { title: "KL2J Land Surveying and Engineering Services" },
      {
        name: "description",
        content:
          "Licensed geodetic engineers offering relocation, subdivision, consolidation, topographic, verification, as-built surveys, and land titling assistance.",
      },
      { property: "og:title", content: "KL2J Land Surveying and Engineering Services" },
      {
        property: "og:description",
        content:
          "Licensed geodetic engineers offering relocation, subdivision, consolidation, topographic, verification, as-built surveys, and land titling assistance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});

const FALLBACK_SERVICES = [
  {
    icon: "MapPin",
    title: "Relocation Survey",
    desc: "Re-establish lost or disputed property corners on the ground using approved technical descriptions and titles.",
  },
  {
    icon: "Split",
    title: "Subdivision Survey",
    desc: "Divide a titled parcel into two or more lots with individual technical descriptions ready for titling.",
  },
  {
    icon: "Combine",
    title: "Consolidation Survey",
    desc: "Merge two or more adjoining lots into a single titled property with a unified boundary description.",
  },
  {
    icon: "Mountain",
    title: "Topographic Survey",
    desc: "Capture ground elevations, contours, and features for architectural, engineering, and site development plans.",
  },
  {
    icon: "Layers",
    title: "Consolidation-Subdivision Survey",
    desc: "Combine adjoining lots and re-subdivide them into new, precisely defined parcels in one approved plan.",
  },
  {
    icon: "ShieldCheck",
    title: "Verification Survey",
    desc: "Confirm boundaries, monuments, and areas of existing surveys against records to resolve discrepancies.",
  },
  {
    icon: "Building2",
    title: "As-Built Survey",
    desc: "Document the exact location of constructed improvements for compliance, occupancy, and turnover requirements.",
  },
  {
    icon: "FileCheck2",
    title: "Land Titling Assistance",
    desc: "End-to-end guidance through DENR-LMB, LRA, and Registry of Deeds processing to secure your land title.",
  },
];

function LandingPage() {
  const confirm = useConfirm();
  const [selectedService, setSelectedService] = useState("");

  async function goToServiceForm(title: string) {
    if (!(await confirm(`Get inquiry for "${title}"?`, { confirmLabel: "Yes, continue" }))) return;
    setSelectedService(title);
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }

  // This route is ssr:false, so a fresh load at e.g. "/#services" arrives
  // with an empty HTML shell — the browser's one-shot native hash-scroll
  // fires before React has mounted anything, finds no #services element,
  // and gives up for good (it never retries once the element exists).
  // Some sections (Projects/Reviews/Photos) also render null until their
  // data query resolves, so even a mount-time check can be too early.
  // Poll every frame for a few seconds instead, so the scroll actually
  // happens once the target shows up.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    let cancelled = false;
    let frame: number;
    const deadline = Date.now() + 5000;

    function tryScroll() {
      if (cancelled) return;
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
      if (Date.now() < deadline) {
        frame = requestAnimationFrame(tryScroll);
      }
    }
    tryScroll();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <Hero />
      <TrustStrip />
      <Services onServiceClick={goToServiceForm} />
      <Process />
      <WhyUs />
      <Credentials />
      <Projects />
      <Reviews />
      <FacebookCTA />
      <Photos />
      <CTA selectedService={selectedService} onSelectedServiceChange={setSelectedService} />
      <Partners />
      <Footer />
      <ChatWidget />
    </div>
  );
}

function NavBar() {
  const [open, setOpen] = useState(false);
  const { data: settings } = usePublicSiteSettings();
  const logo = settings?.logo_url || logoUrl;
  const links = [
    { href: "#services", label: "Services" },
    { href: "#process", label: "Process" },
    { href: "#credentials", label: "Credentials" },
    { href: "#projects", label: "Projects" },
    { href: "#reviews", label: "Reviews" },
    { href: "#photos", label: "Photos" },
    { href: "#why", label: "Why us" },
    { href: "#contact", label: "Contact" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
        <a href="#top" className="flex shrink-0 items-center gap-2.5 font-bold">
          <img
            src={logo}
            alt="KL2J Land Surveying and Engineering Services"
            className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
          />
          <span className="whitespace-nowrap text-base tracking-tight">
            KL2J{" "}
            <span className="hidden whitespace-nowrap font-medium text-muted-foreground lg:inline">
              Land Surveying and Engineering Services
            </span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-muted-foreground hover:text-foreground transition"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/my-inquiries"
            className="whitespace-nowrap text-muted-foreground hover:text-foreground transition"
          >
            My Inquiries
          </Link>
        </nav>
        <button
          className="md:hidden p-2 rounded hover:bg-accent"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <div className="w-5 h-0.5 bg-foreground mb-1" />
          <div className="w-5 h-0.5 bg-foreground mb-1" />
          <div className="w-5 h-0.5 bg-foreground" />
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 flex flex-col gap-3 text-sm">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-1">
              {l.label}
            </a>
          ))}
          <Link
            to="/my-inquiries"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center h-10 rounded-md border border-border font-semibold"
          >
            My Inquiries
          </Link>
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center h-10 rounded-md bg-primary text-primary-foreground font-semibold"
          >
            Request a quote
          </a>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const { data: settings } = usePublicSiteSettings();
  const logo = settings?.logo_url || logoUrl;
  const hero = settings?.hero_banner_url || heroImage;
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={hero}
          alt="Licensed geodetic engineer operating a total station in the field"
          width={1920}
          height={1280}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-primary/30" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-20 text-white">
        <div className="flex items-center gap-4">
          <img
            src={logo}
            alt="KL2J logo"
            className="h-16 w-16 md:h-20 md:w-20 rounded-full ring-2 ring-white/30 bg-white/95 object-cover shadow-xl"
          />
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs uppercase tracking-wider">
            <BadgeCheck className="h-3.5 w-3.5" /> Licensed Geodetic Engineers
          </span>
        </div>
        <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight max-w-3xl leading-[1.05]">
          Precise land surveys.
          <br />
          Clean, defensible titles.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-white/85">
          From relocating lost corners to subdivision, topographic, and as-built work — we deliver
          survey-grade accuracy and full titling support so your project moves forward with
          confidence.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#services"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-md bg-primary text-primary-foreground font-semibold whitespace-nowrap hover:bg-primary/90"
          >
            Explore our services
          </a>
          <Link
            to="/my-inquiries"
            className="inline-flex items-center h-12 px-5 rounded-md bg-primary text-primary-foreground font-semibold whitespace-nowrap hover:bg-primary/90"
          >
            My Inquiries
          </Link>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-md bg-primary text-primary-foreground font-semibold whitespace-nowrap hover:bg-primary/90"
          >
            Request a quote <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: Award, label: "PRC-licensed engineers" },
    { icon: Ruler, label: "Survey-grade instruments" },
    { icon: Clock, label: "On-time deliverables" },
    { icon: Landmark, label: "DENR & LRA experienced" },
  ];
  return (
    <div className="border-b border-border bg-secondary/40">
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3 text-muted-foreground">
            <it.icon className="h-5 w-5 text-primary shrink-0" />
            <span className="font-medium text-foreground">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Services({ onServiceClick }: { onServiceClick: (title: string) => void }) {
  const { data } = usePublicServices();
  const items =
    data && data.length > 0
      ? data.map((s) => ({ icon: s.icon, title: s.title, desc: s.description }))
      : FALLBACK_SERVICES;

  return (
    <section id="services" className="max-w-6xl mx-auto px-4 py-14 md:py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Our services</p>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          Comprehensive geodetic and titling solutions
        </h2>
        <p className="mt-4 text-muted-foreground">
          Whether you're a landowner clarifying boundaries, a developer preparing a subdivision, or
          an engineer needing precise site data — we cover the full spectrum of professional
          surveying work.
        </p>
      </div>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((s) => {
          const Icon = getServiceIcon(s.icon);
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => onServiceClick(s.title)}
              className="group rounded-xl border border-border bg-card p-6 text-left hover:border-primary/40 hover:shadow-lg transition"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
                Get a quote <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    {
      n: "01",
      title: "Consultation",
      desc: "Share your title, sketch, or project brief. We assess scope, timeline, and permits required.",
    },
    {
      n: "02",
      title: "Fieldwork",
      desc: "Our team conducts precise field measurements using total stations, GNSS, and drone surveys where suited.",
    },
    {
      n: "03",
      title: "Plan preparation",
      desc: "We compute, plot, and prepare the survey returns and technical descriptions for approval.",
    },
    {
      n: "04",
      title: "Approval & titling",
      desc: "We shepherd your documents through DENR-LMB, LRA, and the Registry of Deeds until you hold clean title.",
    },
  ];
  return (
    <section id="process" className="bg-secondary/40 border-y border-border">
      <div className="max-w-6xl mx-auto px-4 py-14 md:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">How we work</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            A clear, four-step process
          </h2>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl bg-card border border-border p-6">
              <div className="text-3xl font-bold text-primary/70">{s.n}</div>
              <h3 className="mt-3 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyUs() {
  const points = [
    {
      icon: BadgeCheck,
      title: "Licensed & accountable",
      desc: "Every plan is signed and sealed by a PRC-licensed Geodetic Engineer with full professional accountability.",
    },
    {
      icon: Ruler,
      title: "Modern instrumentation",
      desc: "Total stations, GNSS/RTK receivers, and drone photogrammetry deliver millimeter-grade repeatability.",
    },
    {
      icon: Landmark,
      title: "Titling expertise",
      desc: "Years of navigating LRA, DENR, and Registry of Deeds workflows so your paperwork clears the first time.",
    },
    {
      icon: Clock,
      title: "Predictable timelines",
      desc: "Transparent milestones and status updates from day one through release of the approved plan.",
    },
  ];
  return (
    <section id="why" className="max-w-6xl mx-auto px-4 py-14 md:py-16">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Why choose us
          </p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Accuracy you can build on
          </h2>
          <p className="mt-4 text-muted-foreground">
            Field precision, careful computation, and hands-on titling experience you can rely on.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {points.map((p) => (
            <div key={p.title} className="rounded-xl border border-border p-5 bg-card">
              <p.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA({
  selectedService,
  onSelectedServiceChange,
}: {
  selectedService: string;
  onSelectedServiceChange: (title: string) => void;
}) {
  return (
    <section id="contact" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-slate-900" />
      <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-16 text-primary-foreground">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Ready to survey your land?
            </h2>
            <p className="mt-4 text-primary-foreground/85 max-w-lg">
              Tell us about your parcel or project. We'll get back within one business day with a
              scoped quote and estimated timeline.
            </p>
            <div className="mt-8 space-y-3 text-sm">
              <a href="tel:+639296410776" className="flex items-center gap-3 hover:underline">
                <Phone className="h-4 w-4" /> 0929 641 0776{" "}
                <span className="text-primary-foreground/70">(Smart)</span>
              </a>
              <a href="tel:+639954608248" className="flex items-center gap-3 hover:underline">
                <Phone className="h-4 w-4" /> 0995 460 8248{" "}
                <span className="text-primary-foreground/70">(Globe)</span>
              </a>
              <a
                href="mailto:kl2j.engineering@gmail.com"
                className="flex items-center gap-3 hover:underline"
              >
                <Mail className="h-4 w-4" /> kl2j.engineering@gmail.com
              </a>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4" /> Serving clients nationwide
              </div>
              <a
                href={FACEBOOK_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:underline"
              >
                <Facebook className="h-4 w-4" /> Follow us on Facebook
              </a>
              <a
                href={FACEBOOK_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:underline"
              >
                <FileText className="h-4 w-4" /> View credentials & documents
              </a>
            </div>
          </div>
          <ContactForm service={selectedService} onServiceChange={onSelectedServiceChange} />
        </div>
      </div>
    </section>
  );
}

type ChecklistAnswer = {
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: UploadedDocument[];
};

function ContactForm({
  service,
  onServiceChange,
}: {
  service: string;
  onServiceChange: (title: string) => void;
}) {
  const [sent, setSent] = useState(false);
  const [inquiryCode, setInquiryCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, ChecklistAnswer>>({});
  const sendInquiry = useServerFn(submitInquiry);
  const { data: servicesData } = usePublicServices();
  const serviceOptions = servicesData ?? [];
  const selectedServiceChecklist = serviceOptions.find((s) => s.title === service)?.checklist ?? [];

  function chooseService(title: string) {
    onServiceChange(title);
    setChecklistAnswers({});
  }

  function updateChecklistAnswer(id: string, patch: ChecklistAnswer) {
    setChecklistAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  }

  const hasAnyInput =
    fullName.trim() !== "" ||
    email.trim() !== "" ||
    phone.trim() !== "" ||
    service !== "" ||
    message.trim() !== "" ||
    Object.keys(checklistAnswers).length > 0;

  function clearForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    onServiceChange("");
    setMessage("");
    setChecklistAnswers({});
  }

  function validate(): string | null {
    if (!fullName.trim()) return "Enter your full name";
    if (!email.trim()) return "Enter your email";
    if (!phone.trim()) return "Enter your phone number";
    if (!service) return "Select a service";
    if (!message.trim()) return "Tell us about your property";
    for (const item of selectedServiceChecklist) {
      if (item.type === "document") continue;
      const a = checklistAnswers[item.id];
      if (item.type === "checkbox") {
        if (a?.checked === undefined) return `Please answer "${item.label}"`;
        continue;
      }
      if (!a?.answer?.trim()) return `Please fill in "${item.label}"`;
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const result = await sendInquiry({
        data: {
          name: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          service: service || null,
          message: message.trim() || null,
          channel: "quote_form",
          checklist_responses: selectedServiceChecklist.map((item) => ({
            id: item.id,
            label: item.label,
            type: item.type,
            checked: checklistAnswers[item.id]?.checked,
            answer: checklistAnswers[item.id]?.answer,
            hasDocument: checklistAnswers[item.id]?.hasDocument ?? false,
            documents: checklistAnswers[item.id]?.documents ?? [],
          })),
          status: "New",
        },
      });
      setInquiryCode(result.inquiryCode);
      setSent(true);
    } catch (err) {
      console.error(err);
      toast.error(
        "Something went wrong sending your request. Please try again or call us directly.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-card text-card-foreground p-6 md:p-8 shadow-xl border border-white/10"
    >
      {sent ? (
        <div className="text-center py-10">
          <BadgeCheck className="h-10 w-10 text-primary mx-auto" />
          <h3 className="mt-3 text-xl font-semibold">Thanks — we'll be in touch.</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A geodetic engineer will reach out within one business day.
          </p>
          {inquiryCode && (
            <div className="mt-5 mx-auto max-w-xs rounded-lg bg-secondary/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your inquiry code
              </p>
              <p className="mt-1 text-2xl font-bold tracking-wide text-primary">{inquiryCode}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inquiryCode);
                  toast.success("Code copied");
                }}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                Copy code
              </button>
              <p className="mt-2 text-xs text-muted-foreground">We've also emailed it to you.</p>
              <div className="mt-3 rounded-md bg-background/60 p-3 text-left text-xs text-muted-foreground">
                <p className="font-semibold uppercase tracking-wide text-foreground">
                  How to use this code
                </p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>Open the My Inquiries page (link below).</li>
                  <li>Your inquiry loads automatically using this code.</li>
                  <li>Check your status or message our team anytime.</li>
                </ol>
              </div>
              <Link
                to="/my-inquiries"
                search={{ code: inquiryCode }}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Go to My Inquiries
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Request a quote</h3>
            {hasAnyInput && (
              <button
                type="button"
                onClick={clearForm}
                className="text-xs font-medium text-muted-foreground hover:text-destructive"
              >
                Clear form
              </button>
            )}
          </div>
          <div className="mt-5 grid gap-4">
            <Field
              label={
                <>
                  Full name <RequiredMark />
                </>
              }
            >
              <input
                required
                className="input"
                placeholder="Juan dela Cruz"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label={
                  <>
                    Email <RequiredMark />
                  </>
                }
              >
                <input
                  required
                  type="email"
                  className="input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    Phone <RequiredMark />
                  </>
                }
              >
                <input
                  required
                  className="input"
                  placeholder="0929 641 0776 / 0995 460 8248"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label={
                <>
                  Service needed <RequiredMark />
                </>
              }
            >
              <select
                className="input"
                value={service}
                onChange={(e) => chooseService(e.target.value)}
              >
                <option value="" disabled>
                  Select a service
                </option>
                {(serviceOptions.length > 0 ? serviceOptions : FALLBACK_SERVICES).map((s) => (
                  <option key={s.title}>{s.title}</option>
                ))}
                <option>Not sure yet</option>
              </select>
            </Field>
            {selectedServiceChecklist.length > 0 && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  A few details for this service
                </p>
                <div className="space-y-3">
                  {selectedServiceChecklist.map((item) => {
                    const a = checklistAnswers[item.id] ?? {};
                    if (item.type === "checkbox") {
                      return (
                        <div key={item.id}>
                          <span className="mb-1 block text-xs text-muted-foreground">
                            {item.label} <RequiredMark />
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
                            {item.label} <RequiredMark />
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
                            {item.label} <RequiredMark />
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input"
                              value={areaValue}
                              onChange={(e) =>
                                updateChecklistAnswer(item.id, {
                                  answer: joinAreaAnswer(e.target.value, areaUnit),
                                })
                              }
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
                              className="h-10 shrink-0 rounded-md border border-input px-2 text-sm"
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
                          {item.label} <RequiredMark />
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type={item.type === "number" ? "number" : "text"}
                            className="input"
                            value={a.answer ?? ""}
                            onChange={(e) =>
                              updateChecklistAnswer(item.id, { answer: e.target.value })
                            }
                          />
                          {item.unit && (
                            <span className="shrink-0 text-sm text-muted-foreground">
                              {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <Field
              label={
                <>
                  Tell us about your property <RequiredMark />
                </>
              }
            >
              <textarea
                rows={4}
                className="input resize-none"
                placeholder="Location, lot area, title number if any, and what you need done."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex items-center justify-center gap-2 h-12 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send request"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
      <style>{`
        .input {
          width: 100%;
          height: 44px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          padding: 0 12px;
          font-size: 14px;
          outline: none;
        }
        textarea.input { height: auto; padding: 10px 12px; }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-ring) 25%, transparent); }
      `}</style>
    </form>
  );
}

function RequiredMark() {
  return <span className="text-destructive"> (required)</span>;
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

const galleryModules = import.meta.glob<{ default: string }>("@/assets/gallery/*.jpg", {
  eager: true,
});
const FALLBACK_GALLERY_PHOTOS = Object.entries(galleryModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => ({
    url: mod.default,
    name: path.split("/").pop() ?? "photo",
  }));

function FacebookCTA() {
  return (
    <section className="bg-primary/5 border-y border-primary/10">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-background px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Facebook className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <span className="font-semibold">Stay connected</span>
              <span className="text-muted-foreground"> — follow KL2J on Facebook for updates.</span>
            </div>
          </div>
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shrink-0"
          >
            Visit page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

const FALLBACK_CREDENTIALS = [
  {
    img: prcUrl,
    title: "PRC Licensed Professionals",
    description:
      "Our team is composed of Professional Regulation Commission (PRC) licensed Civil and Geodetic Engineers — ensuring every survey is signed and sealed by qualified professionals.",
    badge: "PRC Licensed",
  },
  {
    img: secUrl,
    title: "SEC Registered Business",
    description:
      "KL2J Land Surveying and Engineering Services is a duly registered partnership with the Securities and Exchange Commission (SEC) of the Republic of the Philippines.",
    badge: "SEC Registered",
  },
];

function Credentials() {
  const { data } = usePublicDocuments();
  const items =
    data && data.length > 0
      ? data.map((d) => ({
          img: d.url,
          title: d.title,
          description: d.description ?? "",
          badge:
            d.category === "license"
              ? "License"
              : d.category === "registration"
                ? "Registered"
                : "Document",
        }))
      : FALLBACK_CREDENTIALS;
  return (
    <section id="credentials" className="bg-muted/40 border-y border-border">
      <div className="max-w-6xl mx-auto px-4 py-14 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Legitimacy & Credibility
          </p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Trusted, licensed, and officially registered
          </h2>
          <p className="mt-4 text-muted-foreground">
            We operate with full regulatory compliance so clients can transact with complete
            confidence.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {items.map((item) => (
            <article
              key={item.title}
              className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/5] bg-muted overflow-hidden">
                <img
                  src={item.img}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {item.badge}
                </div>
                <h3 className="mt-3 text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectDateRange({ p }: { p: { start_date: string | null; end_date: string | null } }) {
  if (!p.start_date) return null;
  return (
    <>
      {" · "}
      {new Date(p.start_date).toLocaleDateString()}
      {p.end_date ? ` – ${new Date(p.end_date).toLocaleDateString()}` : ""}
    </>
  );
}

function Projects() {
  const { data } = usePublicProjects();
  const search = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const deepLinkOpened = useRef(false);

  useEffect(() => {
    if (deepLinkOpened.current || !search.project || !data) return;
    if (data.some((p) => p.id === search.project)) {
      setSelectedId(search.project);
      deepLinkOpened.current = true;
    }
  }, [search.project, data]);

  if (!data || data.length === 0) return null;

  const selected = data.find((p) => p.id === selectedId) ?? null;

  function openAttachments(docs: PublicAttachment[], startIndex: number) {
    const items: LightboxItem[] = docs.map((d) => ({
      name: d.name,
      kind: d.isExternalLink ? "external" : d.type,
      resolveUrl: () => d.url,
    }));
    setLightbox({ items, index: startIndex });
  }

  return (
    <section id="projects" className="max-w-6xl mx-auto px-4 py-14 md:py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Portfolio</p>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Completed projects</h2>
        <p className="mt-3 text-muted-foreground">
          A sample of surveys and titling work we've delivered.
        </p>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(p.id)}
            className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
          >
            {p.cover_photo_url && (
              <div className="aspect-video overflow-hidden bg-muted">
                <img
                  src={p.cover_photo_url}
                  alt={p.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  loading="lazy"
                />
              </div>
            )}
            <div className="p-5">
              <h3 className="font-semibold text-lg">{p.title}</h3>
              {p.location && (
                <div className="mt-0.5 text-sm text-muted-foreground">{p.location}</div>
              )}
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
                {p.service}
                <ProjectDateRange p={p} />
              </div>
              {p.personnel?.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Team: {p.personnel.join(", ")}
                </div>
              )}
              {p.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selected.cover_photo_url && (
              <img
                src={selected.cover_photo_url}
                alt={selected.title}
                className="aspect-video w-full rounded-t-2xl object-cover"
              />
            )}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-bold">{selected.title}</h3>
                <button
                  onClick={() => setSelectedId(null)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {selected.location && (
                <div className="text-sm text-muted-foreground">{selected.location}</div>
              )}
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
                {selected.service}
                <ProjectDateRange p={selected} />
              </div>
              {selected.personnel?.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Team: {selected.personnel.join(", ")}
                </div>
              )}
              {selected.description && (
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                  {selected.description}
                </p>
              )}
              {selected.attachments?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Files
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selected.attachments.map((a, i) =>
                      a.type === "image" ? (
                        <button
                          key={a.path}
                          type="button"
                          onClick={() => openAttachments(selected.attachments, i)}
                          className="aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                        >
                          <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                        </button>
                      ) : a.type === "video" ? (
                        <button
                          key={a.path}
                          type="button"
                          onClick={() => openAttachments(selected.attachments, i)}
                          className="group relative col-span-2 aspect-video overflow-hidden rounded-lg border border-border bg-muted sm:col-span-3"
                        >
                          <video
                            src={a.url}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25 transition group-hover:bg-slate-950/40">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
                              <Play className="h-4 w-4 fill-slate-900 text-slate-900" />
                            </div>
                          </div>
                        </button>
                      ) : (
                        <button
                          key={a.path}
                          type="button"
                          onClick={() => openAttachments(selected.attachments, i)}
                          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm hover:bg-muted"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{a.name}</span>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {lightbox && (
        <AttachmentLightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

function StarRatingDisplay({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  const initial = review.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="w-[280px] shrink-0 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium">{review.name}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(review.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <StarRatingDisplay rating={review.rating} />
      </div>
      {review.review_text && (
        <p className="mt-2 line-clamp-5 text-sm text-muted-foreground">{review.review_text}</p>
      )}
    </div>
  );
}

function Reviews() {
  const { data } = usePublicReviews();
  const [showForm, setShowForm] = useState(false);
  const reviews = data ?? [];
  const count = reviews.length;
  const average = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

  return (
    <section id="reviews" className="border-y border-border bg-secondary/40">
      <div className="max-w-6xl mx-auto px-4 py-14 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Client Reviews
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">What clients say</h2>
            {count > 0 ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-2xl font-bold">{average.toFixed(1)}</span>
                <StarRatingDisplay rating={average} size="h-5 w-5" />
                <span className="text-sm text-muted-foreground">
                  ({count} review{count === 1 ? "" : "s"})
                </span>
              </div>
            ) : (
              <p className="mt-3 text-muted-foreground">
                Be the first to share your experience with KL2J.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Star className="h-4 w-4" /> Write a review
          </button>
        </div>

        {count > 0 && (
          <div className="-mx-4 mt-8 overflow-x-auto px-4">
            <div className="flex gap-4 pb-2">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && <WriteReviewModal onClose={() => setShowForm(false)} />}
    </section>
  );
}

type GalleryItem = { url: string; name: string; type: "photo" | "video" };

function GalleryThumb({
  item,
  index,
  onOpen,
  alt,
}: {
  item: GalleryItem;
  index: number;
  onOpen: (i: number) => void;
  alt: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/40"
    >
      {item.type === "video" ? (
        <>
          <video
            src={item.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25 transition group-hover:bg-slate-950/40">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
              <Play className="h-4 w-4 fill-slate-900 text-slate-900" />
            </div>
          </div>
        </>
      ) : (
        <>
          <img
            src={item.url}
            alt={alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
          <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition" />
        </>
      )}
    </button>
  );
}

function Photos() {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { data } = usePublicGalleryPhotos();
  const galleryItems: GalleryItem[] =
    data && data.length > 0
      ? data.map((p) => ({ url: p.url, name: p.id, type: p.media_type }))
      : FALLBACK_GALLERY_PHOTOS.map((p) => ({ ...p, type: "photo" as const }));
  const photoItems = galleryItems
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.type === "photo");
  const videoItems = galleryItems
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.type === "video");
  const close = () => setLightbox(null);
  const prev = () =>
    setLightbox((i) => (i === null ? null : (i - 1 + galleryItems.length) % galleryItems.length));
  const next = () => setLightbox((i) => (i === null ? null : (i + 1) % galleryItems.length));

  return (
    <section id="photos" className="max-w-6xl mx-auto px-4 py-14 md:py-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Field gallery
          </p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            See our team on the ground
          </h2>
          <p className="mt-3 text-muted-foreground">
            Project photos, equipment in action, and completed surveys from KL2J field operations.
            Tap any photo or video to view it full-size.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex shrink-0 items-center gap-2 h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 self-start"
        >
          <Maximize2 className="h-4 w-4" /> View all
        </button>
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Photos
          </h3>
          <div className="mt-3 -mx-4 px-4 overflow-x-auto">
            <div className="grid grid-flow-col grid-rows-2 auto-cols-[140px] sm:auto-cols-[170px] gap-3 pb-2">
              {photoItems.map(({ item, i }) => (
                <GalleryThumb
                  key={item.name}
                  item={item}
                  index={i}
                  onOpen={setLightbox}
                  alt={`KL2J field survey photo ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {videoItems.length > 0 && (
          <div className="border-t border-border pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Videos
            </h3>
            <div className="mt-3 -mx-4 px-4 overflow-x-auto">
              <div className="grid grid-flow-col grid-rows-2 auto-cols-[140px] sm:auto-cols-[170px] gap-3 pb-2">
                {videoItems.map(({ item, i }) => (
                  <GalleryThumb
                    key={item.name}
                    item={item}
                    index={i}
                    onOpen={setLightbox}
                    alt={`KL2J field survey video ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAll && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setShowAll(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-card p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">
                Full gallery ({photoItems.length} photo{photoItems.length === 1 ? "" : "s"}
                {videoItems.length > 0
                  ? `, ${videoItems.length} video${videoItems.length === 1 ? "" : "s"}`
                  : ""}
                )
              </h3>
              <button
                onClick={() => setShowAll(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Photos
                </h4>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photoItems.map(({ item, i }) => (
                    <GalleryThumb
                      key={item.name}
                      item={item}
                      index={i}
                      onOpen={setLightbox}
                      alt={`KL2J field survey photo ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
              {videoItems.length > 0 && (
                <div className="border-t border-border pt-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Videos
                  </h4>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {videoItems.map(({ item, i }) => (
                      <GalleryThumb
                        key={item.name}
                        item={item}
                        index={i}
                        onOpen={setLightbox}
                        alt={`KL2J field survey video ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={close}
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xl"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="Close"
          >
            ×
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-2xl"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous"
          >
            ‹
          </button>
          {galleryItems[lightbox].type === "video" ? (
            <video
              src={galleryItems[lightbox].url}
              controls
              autoPlay
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={galleryItems[lightbox].url}
              alt={`KL2J field survey photo ${lightbox + 1}`}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-2xl"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {lightbox + 1} / {galleryItems.length}
          </div>
        </div>
      )}
    </section>
  );
}

function Partners() {
  const { data } = usePublicPartnerCompanies();
  if (!data || data.length === 0) return null;

  return (
    <section className="border-t border-border bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center gap-2 text-center">
          <Handshake className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Tied-up companies
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-8">
          {data.map((c) =>
            c.website_url ? (
              <a
                key={c.id}
                href={c.website_url}
                target="_blank"
                rel="noopener noreferrer"
                title={c.name}
                className="flex h-16 w-32 items-center justify-center grayscale transition hover:grayscale-0"
              >
                <img
                  src={c.logo_url}
                  alt={c.name}
                  className="max-h-full max-w-full object-contain"
                />
              </a>
            ) : (
              <div
                key={c.id}
                title={c.name}
                className="flex h-16 w-32 items-center justify-center grayscale"
              >
                <img
                  src={c.logo_url}
                  alt={c.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { data: settings } = usePublicSiteSettings();
  const logo = settings?.logo_url || logoUrl;
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <img src={logo} alt="KL2J logo" className="h-6 w-6 rounded-full object-cover" />
          KL2J Land Surveying and Engineering Services
        </div>
        <div className="flex items-center gap-4">
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Facebook className="h-4 w-4" /> Facebook
          </a>
          <a
            href={FACEBOOK_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <FileText className="h-4 w-4" /> Documents <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div>
          © {new Date().getFullYear()} KL2J Land Surveying and Engineering Services. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
