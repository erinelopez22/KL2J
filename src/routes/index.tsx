import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";

const FACEBOOK_PAGE_URL = "https://www.facebook.com/profile.php?id=61581147040190";
const FACEBOOK_DOCS_URL =
  "https://www.facebook.com/permalink.php?story_fbid=pfbid0pDhu8X7Zwkpwrpti3ccFEXWoHni2X6X8bip1Lo9DaoCJFZLX9oDkxifCbhfxDnM6l&id=61581147040190";
const FACEBOOK_PHOTOS_URL = "https://www.facebook.com/profile.php?id=61581147040190&sk=photos_by";
import logoAsset from "@/assets/kl2j-logo.jpg.asset.json";
import bannerAsset from "@/assets/kl2j-banner.jpg.asset.json";
const heroImage = bannerAsset.url;

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "KL2J Geodetic Services — Licensed Land Surveying" },
      {
        name: "description",
        content:
          "Licensed geodetic engineers offering relocation, subdivision, consolidation, topographic, verification, as-built surveys, and land titling assistance.",
      },
      { property: "og:title", content: "KL2J Geodetic Services — Licensed Land Surveying" },
      {
        property: "og:description",
        content:
          "Precision land surveying and titling assistance for landowners, developers, and engineers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});

const services = [
  {
    icon: MapPin,
    title: "Relocation Survey",
    desc: "Re-establish lost or disputed property corners on the ground using approved technical descriptions and titles.",
  },
  {
    icon: Split,
    title: "Subdivision Survey",
    desc: "Divide a titled parcel into two or more lots with individual technical descriptions ready for titling.",
  },
  {
    icon: Combine,
    title: "Consolidation Survey",
    desc: "Merge two or more adjoining lots into a single titled property with a unified boundary description.",
  },
  {
    icon: Mountain,
    title: "Topographic Survey",
    desc: "Capture ground elevations, contours, and features for architectural, engineering, and site development plans.",
  },
  {
    icon: Layers,
    title: "Consolidation-Subdivision Survey",
    desc: "Combine adjoining lots and re-subdivide them into new, precisely defined parcels in one approved plan.",
  },
  {
    icon: ShieldCheck,
    title: "Verification Survey",
    desc: "Confirm boundaries, monuments, and areas of existing surveys against records to resolve discrepancies.",
  },
  {
    icon: Building2,
    title: "As-Built Survey",
    desc: "Document the exact location of constructed improvements for compliance, occupancy, and turnover requirements.",
  },
  {
    icon: FileCheck2,
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
      <Photos />
      <CTA />
      <Footer />
    </div>
  );
}

function NavBar() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#services", label: "Services" },
    { href: "#process", label: "Process" },
    { href: "#photos", label: "Photos" },
    { href: "#why", label: "Why us" },
    { href: "#contact", label: "Contact" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 font-bold">
          <img
            src={logoAsset.url}
            alt="KL2J Land Surveying and Engineering Services"
            className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
          />
          <span className="text-lg tracking-tight">
            KL2J <span className="text-muted-foreground font-medium hidden sm:inline">Geodetic</span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground transition">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
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
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
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
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Licensed geodetic engineer operating a total station in the field"
          width={1920}
          height={1280}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-primary/30" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32 text-white">
        <div className="flex items-center gap-4">
          <img
            src={logoAsset.url}
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
  return (
    <section id="services" className="max-w-6xl mx-auto px-4 py-20 md:py-28">
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
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {services.map((s) => (
          <div
            key={s.title}
            className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg transition"
          >
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
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
      <div className="max-w-6xl mx-auto px-4 py-20 md:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">How we work</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            A clear, four-step process
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
    <section id="why" className="max-w-6xl mx-auto px-4 py-20 md:py-28">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Why choose us</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Accuracy you can build on
          </h2>
          <p className="mt-4 text-muted-foreground">
            Land is your most valuable asset. We combine field precision, careful computation, and
            hands-on titling experience so every boundary line and plan holds up in court, at
            construction, and at the Registry.
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
      <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-24 text-primary-foreground">
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
              <a href="tel:+639000000000" className="flex items-center gap-3 hover:underline">
                <Phone className="h-4 w-4" /> +63 900 000 0000
              </a>
              <a href="mailto:hello@kl2jgeodetic.com" className="flex items-center gap-3 hover:underline">
                <Mail className="h-4 w-4" /> hello@kl2jgeodetic.com
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
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
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
              <input required className="input" placeholder="Juan dela Cruz" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input required type="email" className="input" placeholder="you@email.com" />
              </Field>
              <Field label="Phone">
                <input className="input" placeholder="+63 900 000 0000" />
              </Field>
            </div>
            <Field label="Service needed">
              <select className="input" defaultValue="">
                <option value="" disabled>
                  Select a service
                </option>
                {services.map((s) => (
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
              />
            </Field>
            <button
              type="submit"
              className="mt-1 inline-flex items-center justify-center gap-2 h-12 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
            >
              Send request <ArrowRight className="h-4 w-4" />
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

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Compass className="h-4 w-4 text-primary" />
          KL2J Geodetic Services
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
        <div>© {new Date().getFullYear()} KL2J Geodetic Services. All rights reserved.</div>
      </div>
    </footer>
  );
}
