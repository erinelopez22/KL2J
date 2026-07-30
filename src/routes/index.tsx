import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";
import { ChatWidget } from "@/components/ChatWidget";
import {
  usePublicServices,
  usePublicGalleryPhotos,
  usePublicDocuments,
  usePublicProjects,
  usePublicSiteSettings,
  usePublicPartnerCompanies,
} from "@/lib/public-content";
import { getServiceIcon } from "@/lib/admin/iconMap";

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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <Hero />
      <TrustStrip />
      <Services />
      <Process />
      <WhyUs />
      <Credentials />
      <Projects />
      <FacebookCTA />
      <Photos />
      <CTA />
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
    { href: "#photos", label: "Photos" },
    { href: "#why", label: "Why us" },
    { href: "#contact", label: "Contact" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 font-bold">
          <img
            src={logo}
            alt="KL2J Land Surveying and Engineering Services"
            className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
          />
          <span className="text-base tracking-tight">
            KL2J <span className="text-muted-foreground font-medium hidden sm:inline">Land Surveying and Engineering Services</span>
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
        </nav>
        <div className="hidden md:flex items-center gap-4 ml-8">
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook page"
            className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Facebook className="h-4 w-4" />
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold whitespace-nowrap hover:bg-primary/90"
          >
            Request a quote <ArrowRight className="h-4 w-4" />
          </a>
        </div>
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
            href="#contact"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            Request a free quote <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#services"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-white/10 border border-white/25 font-semibold hover:bg-white/20"
          >
            Explore our services
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

function Services() {
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
            <div
              key={s.title}
              className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg transition"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
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
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Why choose us</p>
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

function CTA() {
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
                <Phone className="h-4 w-4" /> 0929 641 0776 <span className="text-primary-foreground/70">(Smart)</span>
              </a>
              <a href="tel:+639954608248" className="flex items-center gap-3 hover:underline">
                <Phone className="h-4 w-4" /> 0995 460 8248 <span className="text-primary-foreground/70">(Globe)</span>
              </a>
              <a href="mailto:kl2j.engineering@gmail.com" className="flex items-center gap-3 hover:underline">
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
          <ContactForm />
        </div>
      </div>
    </section>
  );
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("");
  const [message, setMessage] = useState("");
  const sendInquiry = useServerFn(submitInquiry);
  const { data: servicesData } = usePublicServices();
  const serviceOptions = servicesData ?? [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendInquiry({
        data: {
          name: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          service: service || null,
          message: message.trim() || null,
          channel: "quote_form",
          status: "New",
        },
      });
      setSent(true);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong sending your request. Please try again or call us directly.");
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
        </div>
      ) : (
        <>
          <h3 className="text-xl font-semibold">Request a quote</h3>
          <div className="mt-5 grid gap-4">
            <Field label="Full name">
              <input
                required
                className="input"
                placeholder="Juan dela Cruz"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input
                  required
                  type="email"
                  className="input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="input"
                  placeholder="0929 641 0776 / 0995 460 8248"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Service needed">
              <select className="input" value={service} onChange={(e) => setService(e.target.value)}>
                <option value="" disabled>
                  Select a service
                </option>
                {(serviceOptions.length > 0 ? serviceOptions : FALLBACK_SERVICES).map((s) => (
                  <option key={s.title}>{s.title}</option>
                ))}
                <option>Not sure yet</option>
              </select>
            </Field>
            <Field label="Tell us about your property">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

const galleryModules = import.meta.glob<{ default: string }>(
  "@/assets/gallery/*.jpg",
  { eager: true },
);
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
          badge: d.category === "license" ? "License" : d.category === "registration" ? "Registered" : "Document",
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!data || data.length === 0) return null;

  const selected = data.find((p) => p.id === selectedId) ?? null;

  return (
    <section id="projects" className="max-w-6xl mx-auto px-4 py-14 md:py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Portfolio</p>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Completed projects</h2>
        <p className="mt-3 text-muted-foreground">A sample of surveys and titling work we've delivered.</p>
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
              {p.location && <div className="mt-0.5 text-sm text-muted-foreground">{p.location}</div>}
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
                {p.service}
                <ProjectDateRange p={p} />
              </div>
              {p.personnel?.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">Team: {p.personnel.join(", ")}</div>
              )}
              {p.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">{p.description}</p>
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
              {selected.location && <div className="text-sm text-muted-foreground">{selected.location}</div>}
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
                {selected.service}
                <ProjectDateRange p={selected} />
              </div>
              {selected.personnel?.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">Team: {selected.personnel.join(", ")}</div>
              )}
              {selected.description && (
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                  {selected.description}
                </p>
              )}
              {selected.attachments?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Files</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selected.attachments.map((a) =>
                      a.type === "image" ? (
                        <a
                          key={a.path}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                        >
                          <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                        </a>
                      ) : a.type === "video" ? (
                        <video key={a.path} src={a.url} controls className="col-span-2 rounded-lg sm:col-span-3" />
                      ) : (
                        <a
                          key={a.path}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm hover:bg-muted"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate">{a.name}</span>
                        </a>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Photos() {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { data } = usePublicGalleryPhotos();
  const galleryPhotos =
    data && data.length > 0 ? data.map((p) => ({ url: p.url, name: p.id })) : FALLBACK_GALLERY_PHOTOS;
  const close = () => setLightbox(null);
  const prev = () =>
    setLightbox((i) => (i === null ? null : (i - 1 + galleryPhotos.length) % galleryPhotos.length));
  const next = () =>
    setLightbox((i) => (i === null ? null : (i + 1) % galleryPhotos.length));

  return (
    <section id="photos" className="max-w-6xl mx-auto px-4 py-14 md:py-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Field gallery</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            See our team on the ground
          </h2>
          <p className="mt-3 text-muted-foreground">
            Project photos, equipment in action, and completed surveys from KL2J field
            operations. Tap any image to view it full-size.
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

      <div className="mt-8 -mx-4 px-4 overflow-x-auto">
        <div className="grid grid-flow-col grid-rows-2 auto-cols-[140px] sm:auto-cols-[170px] gap-3 pb-2">
          {galleryPhotos.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setLightbox(i)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/40"
            >
              <img
                src={p.url}
                alt={`KL2J field survey photo ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition" />
            </button>
          ))}
        </div>
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
              <h3 className="text-lg font-semibold">Full gallery ({galleryPhotos.length} photos)</h3>
              <button
                onClick={() => setShowAll(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {galleryPhotos.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/40"
                >
                  <img
                    src={p.url}
                    alt={`KL2J field survey photo ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition" />
                </button>
              ))}
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
          <img
            src={galleryPhotos[lightbox].url}
            alt={`KL2J field survey photo ${lightbox + 1}`}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
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
            {lightbox + 1} / {galleryPhotos.length}
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
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tied-up companies</p>
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
                <img src={c.logo_url} alt={c.name} className="max-h-full max-w-full object-contain" />
              </a>
            ) : (
              <div key={c.id} title={c.name} className="flex h-16 w-32 items-center justify-center grayscale">
                <img src={c.logo_url} alt={c.name} className="max-h-full max-w-full object-contain" />
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
        <div>© {new Date().getFullYear()} KL2J Land Surveying and Engineering Services. All rights reserved.</div>
      </div>
    </footer>
  );
}
