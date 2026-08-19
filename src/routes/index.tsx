import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
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
  Minimize2,
  Handshake,
  Play,
  Star,
  Folder,
  ArrowLeft,
  Search,
  Move,
  Pencil,
} from "lucide-react";
import { ChatWidget } from "@/components/ChatWidget";
import {
  usePublicServices,
  usePublicEquipment,
  usePublicGalleryPhotos,
  usePublicGalleryFolders,
  type PublicGalleryFolder,
  usePublicDocuments,
  usePublicProjects,
  usePublicSiteSettings,
  usePublicPartnerCompanies,
  usePublicReviews,
  type PublicReview,
  type PublicAttachment,
  type PublicProject,
  type PublicProjectMedia,
} from "@/lib/public-content";
import { LocationAutosuggest } from "@/components/LocationAutosuggest";
import { PublicDocumentUpload, type UploadedDocument } from "@/components/PublicDocumentUpload";
import { getServiceIcon } from "@/lib/admin/iconMap";
import { splitAreaAnswer, joinAreaAnswer } from "@/lib/areaUnit";
import { WriteReviewModal } from "@/components/WriteReviewModal";
import { AttachmentLightbox, type LightboxItem } from "@/components/AttachmentLightbox";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { YesNoToggle } from "@/components/YesNoToggle";
import { mergeChecklists } from "@/lib/serviceChecklist";
import { useEditMode } from "@/lib/editMode";
import { updateBranding } from "@/lib/admin/branding.functions";
import { Slider } from "@/components/ui/slider";
import { CoverImage, DEFAULT_IMAGE_POSITION, type ImagePosition } from "@/components/CoverImage";
import { QuickImageUpload } from "@/components/admin/QuickImageUpload";

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

export function LandingPage() {
  const confirm = useConfirm();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  async function goToServiceForm(title: string) {
    if (!selectedServices.includes(title)) {
      if (!(await confirm(`Add "${title}" to your inquiry?`, { confirmLabel: "Yes, add it" }))) return;
      setSelectedServices((prev) => [...prev, title]);
    }
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
      <CTA selectedServices={selectedServices} onSelectedServicesChange={setSelectedServices} />
      <Partners />
      <Footer />
      <ChatWidget />
    </div>
  );
}

function NavBar() {
  const [open, setOpen] = useState(false);
  const { data: settings } = usePublicSiteSettings();
  const editable = useEditMode();
  const queryClient = useQueryClient();
  const doUpdateBranding = useServerFn(updateBranding);
  const logo = settings?.logo_url || logoUrl;
  const links = [
    { href: "#services", label: "Services" },
    { href: "#process", label: "Process" },
    { href: "#credentials", label: "Credentials" },
    { href: "#projects", label: "Projects" },
    { href: "#reviews", label: "Reviews" },
    { href: "#photos", label: "Gallery" },
    { href: "#why", label: "Why us" },
    { href: "#contact", label: "Contact" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
        <a href="#top" className="flex shrink-0 items-center gap-2.5 font-bold">
          <div className="group/logo relative h-10 w-10 shrink-0">
            <img
              src={logo}
              alt="KL2J Land Surveying and Engineering Services"
              className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
            />
            {editable && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition group-hover/logo:bg-black/50 group-hover/logo:opacity-100">
                <QuickImageUpload
                  folder="branding"
                  label="Change logo"
                  iconOnly
                  className="!bg-transparent hover:!bg-transparent"
                  onUploaded={async (url) => {
                    await doUpdateBranding({ data: { logo_url: url } });
                    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
                  }}
                />
              </div>
            )}
          </div>
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
  const editable = useEditMode();
  const queryClient = useQueryClient();
  const doUpdateBranding = useServerFn(updateBranding);
  const logo = settings?.logo_url || logoUrl;
  const hero = settings?.hero_banner_url || heroImage;
  const savedHeroPosition = settings?.hero_banner_position ?? DEFAULT_IMAGE_POSITION;
  const headline = settings?.hero_headline?.trim();
  const subtitle = settings?.hero_subtitle?.trim();

  const [repositioning, setRepositioning] = useState(false);
  const [draftPosition, setDraftPosition] = useState<ImagePosition | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [savingText, setSavingText] = useState(false);

  const heroPosition = draftPosition ?? savedHeroPosition;

  async function saveBranding(patch: Record<string, unknown>) {
    await doUpdateBranding({ data: patch });
    queryClient.invalidateQueries({ queryKey: ["site-settings"] });
  }

  async function saveText() {
    setSavingText(true);
    try {
      await saveBranding({
        hero_headline: headlineDraft.trim() || undefined,
        hero_subtitle: subtitleDraft.trim() || undefined,
      });
      setEditingText(false);
    } finally {
      setSavingText(false);
    }
  }

  return (
    <section id="top" className="group/hero relative overflow-hidden">
      <div className="absolute inset-0">
        <CoverImage
          src={hero}
          alt="Licensed geodetic engineer operating a total station in the field"
          position={heroPosition}
          editable={editable && repositioning}
          onPositionChange={setDraftPosition}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-primary/30" />
        {editable && !repositioning && (
          <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition group-hover/hero:opacity-100">
            <button
              type="button"
              onClick={() => {
                setDraftPosition(savedHeroPosition);
                setRepositioning(true);
              }}
              className="flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-black/85"
            >
              <Move className="h-3.5 w-3.5" /> Reposition cover photo
            </button>
            <QuickImageUpload
              folder="branding"
              label="Change cover photo"
              onUploaded={(url) => saveBranding({ hero_banner_url: url })}
            />
          </div>
        )}
        {editable && repositioning && (
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3 rounded-xl bg-black/70 px-3 py-2 text-white">
            <span className="text-xs">Zoom</span>
            <Slider
              value={[heroPosition.zoom]}
              onValueChange={([zoom]) => setDraftPosition((p) => ({ ...(p ?? savedHeroPosition), zoom }))}
              min={1}
              max={3}
              step={0.05}
              className="w-32"
            />
            <button
              type="button"
              onClick={async () => {
                if (draftPosition) await saveBranding({ hero_banner_position: draftPosition });
                setRepositioning(false);
                setDraftPosition(null);
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRepositioning(false);
                setDraftPosition(null);
              }}
              className="rounded-md border border-white/30 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-20 text-white pointer-events-none">
        <div className={`flex items-center gap-4 ${repositioning ? "" : "pointer-events-auto"}`}>
          <div className="group/logo relative h-16 w-16 shrink-0 md:h-20 md:w-20">
            <img
              src={logo}
              alt="KL2J logo"
              className="h-16 w-16 md:h-20 md:w-20 rounded-full ring-2 ring-white/30 bg-white/95 object-cover shadow-xl"
            />
            {editable && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition group-hover/logo:bg-black/50 group-hover/logo:opacity-100">
                <QuickImageUpload
                  folder="branding"
                  label="Change logo"
                  iconOnly
                  className="!bg-transparent hover:!bg-transparent"
                  onUploaded={(url) => saveBranding({ logo_url: url })}
                />
              </div>
            )}
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs uppercase tracking-wider">
            <BadgeCheck className="h-3.5 w-3.5" /> Licensed Geodetic Engineers
          </span>
        </div>
        {editable && editingText ? (
          <div
            className={`mt-5 max-w-2xl space-y-2 rounded-xl bg-black/40 p-3 ${repositioning ? "" : "pointer-events-auto"}`}
          >
            <input
              value={headlineDraft}
              onChange={(e) => setHeadlineDraft(e.target.value)}
              placeholder="Precise land surveys.&#10;Clean, defensible titles."
              autoFocus
              className="w-full rounded-md border border-white/30 bg-white/10 px-3 py-2 text-2xl font-bold text-white placeholder:text-white/50 focus:outline-none"
            />
            <textarea
              value={subtitleDraft}
              onChange={(e) => setSubtitleDraft(e.target.value)}
              rows={3}
              placeholder="Subtitle shown under the headline"
              className="w-full resize-none rounded-md border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingText}
                onClick={saveText}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingText(false)}
                className="rounded-md border border-white/30 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : editable ? (
          <button
            type="button"
            onClick={() => {
              setHeadlineDraft(headline ?? "");
              setSubtitleDraft(subtitle ?? "");
              setEditingText(true);
            }}
            className={`group/text mt-5 block max-w-3xl cursor-text rounded-lg text-left hover:bg-white/5 ${repositioning ? "" : "pointer-events-auto"}`}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] whitespace-pre-line">
              {headline || "Precise land surveys.\nClean, defensible titles."}
              <Pencil className="ml-2 inline-block h-5 w-5 align-middle opacity-0 group-hover/text:opacity-70" />
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/85">
              {subtitle ||
                "From relocating lost corners to subdivision, topographic, and as-built work — we deliver survey-grade accuracy and full titling support so your project moves forward with confidence."}
            </p>
          </button>
        ) : (
          <>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight max-w-3xl leading-[1.05] whitespace-pre-line">
              {headline || "Precise land surveys.\nClean, defensible titles."}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/85">
              {subtitle ||
                "From relocating lost corners to subdivision, topographic, and as-built work — we deliver survey-grade accuracy and full titling support so your project moves forward with confidence."}
            </p>
          </>
        )}
        <div className={`mt-8 flex flex-wrap gap-3 ${repositioning ? "" : "pointer-events-auto"}`}>
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
  const { data: equipment } = usePublicEquipment();
  const [showAllEquipment, setShowAllEquipment] = useState(false);
  const EQUIPMENT_PREVIEW_LIMIT = 4;
  const equipmentPreview = equipment?.slice(0, EQUIPMENT_PREVIEW_LIMIT) ?? [];
  const hasMoreEquipment = (equipment?.length ?? 0) > EQUIPMENT_PREVIEW_LIMIT;

  const points = [
    {
      icon: BadgeCheck,
      title: "Licensed & accountable",
      desc: "Every plan is signed and sealed by a PRC-licensed Geodetic Engineer with full professional accountability.",
    },
    {
      icon: Ruler,
      title: "Modern instrumentation",
      desc: "",
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
              {p.title === "Modern instrumentation" && equipmentPreview.length > 0 && (
                <>
                
                    {equipmentPreview.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed"
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                        {item.title}
                      </li>
                    ))}
                  {hasMoreEquipment && (
                    <button
                      type="button"
                      onClick={() => setShowAllEquipment(true)}
                      className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      See more
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAllEquipment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setShowAllEquipment(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Our equipment</h3>
              <button
                onClick={() => setShowAllEquipment(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {(equipment ?? []).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function CTA({
  selectedServices,
  onSelectedServicesChange,
}: {
  selectedServices: string[];
  onSelectedServicesChange: (services: string[]) => void;
}) {
  const formWrapperRef = useRef<HTMLDivElement>(null);
  const [formHeight, setFormHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = formWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setFormHeight(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="contact" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-slate-900" />
      <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-16 text-primary-foreground">
        <div className="grid lg:grid-cols-2 gap-10">
          <div
            className="flex flex-col lg:h-[var(--form-h)]"
            style={
              formHeight ? ({ "--form-h": `${formHeight}px` } as React.CSSProperties) : undefined
            }
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Ready to survey your land?
            </h2>
            <p className="mt-4 text-primary-foreground/85 max-w-lg">
              Tell us about your parcel or project. We'll get back within one business day with a
              scoped quote and estimated timeline.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-primary-foreground/85">
              <a
                href="tel:+639296410776"
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" /> 0929 641 0776
              </a>
              <a
                href="tel:+639954608248"
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" /> 0995 460 8248
              </a>
              <a
                href="mailto:kl2j.engineering@gmail.com"
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <Mail className="h-3.5 w-3.5" /> kl2j.engineering@gmail.com
              </a>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Serving clients nationwide
              </span>
            </div>
            <RelatedProjects services={selectedServices} />
          </div>
          <div ref={formWrapperRef} className="self-start">
            <ContactForm services={selectedServices} onServicesChange={onSelectedServicesChange} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MediaTile({
  m,
  altText,
  badge,
  className,
  onClick,
}: {
  m: { url: string; type: "image" | "video"; position?: { x: number; y: number; zoom: number } };
  altText: string;
  badge?: number;
  className: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {m.type === "video" ? (
        <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : m.position ? (
        <CoverImage src={m.url} alt={altText} position={m.position} />
      ) : (
        <img src={m.url} alt={altText} className="h-full w-full object-cover" />
      )}
      {m.type === "video" && !badge && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
            <Play className="h-3 w-3 fill-slate-900 text-slate-900" />
          </div>
        </div>
      )}
      {!!badge && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
          <span className="text-base font-semibold text-white">+{badge}</span>
        </div>
      )}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

// Collapsed: single row, up to maxVisible tiles, "+N" on the last one if
// there's more. Clicking "+N" expands into a scrollable grid (capped to
// ~3 rows tall) instead of jumping into the lightbox — only when the row is
// interactive (onItemClick provided); the RelatedProjects sidebar cards
// pass no onItemClick, so their "+N" tile stays a plain non-interactive
// badge (the whole card is already a button that opens the project).
function MediaRow({
  media,
  altText,
  maxVisible = 4,
  heightClass = "h-20",
  onItemClick,
  expandedFillParent = false,
}: {
  media: { url: string; type: "image" | "video"; position?: { x: number; y: number; zoom: number } }[];
  altText: string;
  maxVisible?: number;
  heightClass?: string;
  onItemClick?: (index: number) => void;
  // By default the expanded (all-photos) grid caps itself at 480px with its
  // own scrollbar, since most call sites aren't inside a sized flex
  // ancestor. Pass this when the caller already wraps MediaRow in a
  // `min-h-0 flex-1` container that should own the scrolling instead —
  // otherwise you get two nested scrollbars fighting each other.
  expandedFillParent?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (media.length === 0) return null;
  const visibleMedia = media.slice(0, maxVisible);
  const hiddenCount = media.length - visibleMedia.length;

  if (expanded) {
    return (
      <div className={expandedFillParent ? "flex h-full min-h-0 flex-col" : ""}>
        <div
          className={`grid grid-cols-4 gap-1 overflow-y-auto pr-1 ${
            expandedFillParent ? "min-h-0 flex-1" : "max-h-[480px]"
          }`}
        >
          {media.map((m, i) => (
            <MediaTile
              key={i}
              m={m}
              altText={altText}
              className="relative aspect-square overflow-hidden rounded-lg bg-muted"
              onClick={onItemClick ? () => onItemClick(i) : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={`mt-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline ${
            expandedFillParent ? "shrink-0" : ""
          }`}
        >
          Show less
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full gap-1">
      {visibleMedia.map((m, i) => {
        const isLastVisible = i === visibleMedia.length - 1;
        const isOverflowTile = isLastVisible && hiddenCount > 0;
        return (
          <MediaTile
            key={i}
            m={m}
            altText={altText}
            badge={isOverflowTile ? hiddenCount : undefined}
            className={`relative ${heightClass} flex-1 overflow-hidden rounded-lg bg-muted`}
            onClick={
              isOverflowTile
                ? onItemClick
                  ? () => setExpanded(true)
                  : undefined
                : onItemClick
                  ? () => onItemClick(i)
                  : undefined
            }
          />
        );
      })}
    </div>
  );
}

function RelatedProjects({ services }: { services: string[] }) {
  const { data } = usePublicProjects();
  const navigate = useNavigate();
  if (!data || data.length === 0) return null;

  const projects =
    services.length > 0
      ? data.filter((p) => p.services?.some((s) => services.includes(s)))
      : data;
  if (projects.length === 0) return null;

  function openProject(id: string) {
    navigate({ to: "/", search: (prev) => ({ ...prev, project: id }), resetScroll: false });
  }

  return (
    <div className="mt-8 flex min-h-0 flex-1 flex-col">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
        {services.length > 0
          ? `Projects we've completed for ${services.join(", ")}`
          : "Projects we've completed"}
      </p>
      <div className="scrollbar-on-dark mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {projects.map((p) => {
          const coverPhoto = p.photo_urls?.[0] ?? null;
          const coverPosition = coverPhoto ? p.photo_positions?.[coverPhoto] : undefined;
          const media: { url: string; type: "image" | "video"; position?: typeof coverPosition }[] =
            p.media.length > 0
              ? p.media.map((m) => ({ url: m.url, type: m.media_type === "video" ? "video" : "image" }))
              : coverPhoto
                ? [{ url: coverPhoto, type: "image", position: coverPosition }]
                : [];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openProject(p.id)}
              className="block w-full rounded-xl border border-white/10 bg-card p-3 text-left text-card-foreground shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center gap-2.5">
                {coverPhoto ? (
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                    <CoverImage src={coverPhoto} alt={p.title} position={coverPosition} />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Compass className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.location}</p>
                </div>
              </div>
              {p.description && (
                <p className="mt-2 line-clamp-3 text-xs text-card-foreground/80">{p.description}</p>
              )}
              {media.length > 0 && (
                <div className="mt-2">
                  <MediaRow media={media} altText={p.title} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ChecklistAnswer = {
  checked?: boolean;
  answer?: string;
  hasDocument?: boolean;
  documents?: UploadedDocument[];
};

function ContactForm({
  services,
  onServicesChange,
}: {
  services: string[];
  onServicesChange: (services: string[]) => void;
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
  const selectedServiceChecklist = mergeChecklists(serviceOptions, services);

  function toggleService(title: string) {
    onServicesChange(
      services.includes(title) ? services.filter((s) => s !== title) : [...services, title],
    );
    setChecklistAnswers({});
  }

  function updateChecklistAnswer(id: string, patch: ChecklistAnswer) {
    setChecklistAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  }

  const hasAnyInput =
    fullName.trim() !== "" ||
    email.trim() !== "" ||
    phone.trim() !== "" ||
    services.length > 0 ||
    message.trim() !== "" ||
    Object.keys(checklistAnswers).length > 0;

  function clearForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    onServicesChange([]);
    setMessage("");
    setChecklistAnswers({});
  }

  function validate(): string | null {
    if (!fullName.trim()) return "Enter your full name";
    if (!email.trim()) return "Enter your email";
    if (!phone.trim()) return "Enter your phone number";
    if (services.length === 0) return "Select at least one service";
    if (!message.trim()) return "Tell us about your property";
    for (const item of selectedServiceChecklist) {
      if (item.type === "document") continue;
      if (item.required === false) continue;
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
          services,
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
                  Services needed <RequiredMark />
                </>
              }
            >
              <div className="flex flex-wrap gap-2">
                {[...(serviceOptions.length > 0 ? serviceOptions : FALLBACK_SERVICES), { title: "Not sure yet" }].map(
                  (s) => {
                    const checked = services.includes(s.title);
                    return (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => toggleService(s.title)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          checked
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        {s.title}
                      </button>
                    );
                  },
                )}
              </div>
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
                            {item.label} <RequiredMark required={item.required !== false} />
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
                            {item.label} <RequiredMark required={item.required !== false} />
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
                          {item.label} <RequiredMark required={item.required !== false} />
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

function RequiredMark({ required = true }: { required?: boolean }) {
  if (!required) return <span className="text-muted-foreground"> (optional)</span>;
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

const PROJECT_STATUS_BADGE_STYLES: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Ongoing: "bg-indigo-100 text-indigo-700",
  Onhold: "bg-amber-100 text-amber-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-destructive/10 text-destructive",
  Cancelled: "bg-muted text-muted-foreground",
};

function ProjectStatusBadge({
  status,
  className = "",
}: {
  status: string | null;
  className?: string;
}) {
  if (!status) return null;
  const style = PROJECT_STATUS_BADGE_STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style} ${className}`}
    >
      {status}
    </span>
  );
}

function ProjectCard({
  project,
  onClick,
  className = "",
}: {
  project: PublicProject;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {(project.photo_urls?.length ?? 0) > 0 && (
        <div className="relative bg-muted p-2 pb-0">
          <MediaRow
            media={project.photo_urls.map((url) => ({
              url,
              type: "image" as const,
              position: project.photo_positions?.[url],
            }))}
            altText={project.title}
            heightClass="h-36"
          />
          <ProjectStatusBadge
            status={project.inquiry_status}
            className="absolute right-3 top-3 shadow"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg">{project.title}</h3>
          {(project.photo_urls?.length ?? 0) === 0 && (
            <ProjectStatusBadge status={project.inquiry_status} />
          )}
        </div>
        {project.location && (
          <div className="mt-0.5 text-sm text-muted-foreground">{project.location}</div>
        )}
        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
          {project.services?.length > 0 ? project.services.join(", ") : project.service}
          <ProjectDateRange p={project} />
        </div>
        {project.personnel?.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            Team: {project.personnel.join(", ")}
          </div>
        )}
        {project.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
            {project.description}
          </p>
        )}
      </div>
    </button>
  );
}

const PROJECT_VIEW_ALL_SORT_OPTIONS = {
  newest: {
    label: "Newest first",
    cmp: (a: PublicProject, b: PublicProject) =>
      (b.start_date ?? "").localeCompare(a.start_date ?? ""),
  },
  oldest: {
    label: "Oldest first",
    cmp: (a: PublicProject, b: PublicProject) =>
      (a.start_date ?? "").localeCompare(b.start_date ?? ""),
  },
  title_asc: {
    label: "Title A-Z",
    cmp: (a: PublicProject, b: PublicProject) => a.title.localeCompare(b.title),
  },
} as const;
type ProjectViewAllSortKey = keyof typeof PROJECT_VIEW_ALL_SORT_OPTIONS;

function Projects() {
  const { data } = usePublicProjects();
  // strict:false so this also works when LandingPage is rendered outside the
  // "/" route (e.g. the admin preview) — deep-linking via ?project= only
  // matters on the real public route anyway.
  const search = useSearch({ strict: false }) as { project?: string };
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const lastDeepLinkId = useRef<string | null>(null);
  const [allSearch, setAllSearch] = useState("");
  const [allServiceFilter, setAllServiceFilter] = useState("");
  const [allStatusFilter, setAllStatusFilter] = useState("");
  const [allSizeFilter, setAllSizeFilter] = useState<"" | "major" | "small">("");
  const [allSortKey, setAllSortKey] = useState<ProjectViewAllSortKey>("newest");

  useEffect(() => {
    if (!search.project || !data || search.project === lastDeepLinkId.current) return;
    if (data.some((p) => p.id === search.project)) {
      setSelectedId(search.project);
      lastDeepLinkId.current = search.project;
    }
  }, [search.project, data]);

  if (!data || data.length === 0) return null;

  const selected = data.find((p) => p.id === selectedId) ?? null;
  const allServiceOptions = Array.from(
    new Set(
      data.flatMap((p) => (p.services?.length > 0 ? p.services : [p.service])).filter((s): s is string => Boolean(s)),
    ),
  ).sort();
  const allStatusOptions = Array.from(
    new Set(data.map((p) => p.inquiry_status).filter((s): s is string => Boolean(s))),
  ).sort();
  const allSearchLower = allSearch.trim().toLowerCase();
  const filteredAllProjects = data
    .filter((p) => {
      const pServices = p.services?.length > 0 ? p.services : p.service ? [p.service] : [];
      if (allServiceFilter && !pServices.includes(allServiceFilter)) return false;
      if (allStatusFilter && p.inquiry_status !== allStatusFilter) return false;
      if (allSizeFilter && p.size !== allSizeFilter) return false;
      if (!allSearchLower) return true;
      return [p.title, p.location, ...pServices, ...(p.personnel ?? [])]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(allSearchLower));
    })
    .sort(PROJECT_VIEW_ALL_SORT_OPTIONS[allSortKey].cmp);

  function openProject(id: string) {
    setSelectedId(id);
    setShowAll(false);
    setExpanded(false);
  }

  function closeProject() {
    setSelectedId(null);
    setExpanded(false);
    // Clear the deep-link id too, and the guard that tracks it — otherwise
    // search.project still equals the id after closing, so re-clicking the
    // same project elsewhere (e.g. the "Projects we've completed" list)
    // sets the search param to the same value, the effect below never sees
    // a change, and the modal never reopens.
    lastDeepLinkId.current = null;
    if (search.project) {
      navigate({ to: "/", search: (prev) => ({ ...prev, project: undefined }), resetScroll: false });
    }
  }

  function openAttachments(docs: PublicAttachment[], startIndex: number) {
    const items: LightboxItem[] = docs.map((d) => ({
      name: d.name,
      kind: d.isExternalLink ? "external" : d.type,
      resolveUrl: () => d.url,
    }));
    setLightbox({ items, index: startIndex });
  }

  function openMedia(media: PublicProjectMedia[], startIndex: number) {
    const items: LightboxItem[] = media.map((m) => ({
      name: m.caption ?? "Photo",
      kind: m.media_type === "video" ? "video" : "image",
      resolveUrl: () => m.url,
    }));
    setLightbox({ items, index: startIndex });
  }

  return (
    <section id="projects" className="max-w-6xl mx-auto px-4 py-14 md:py-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Portfolio</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Projects</h2>
          <p className="mt-3 text-muted-foreground">Here are some of our handled projects.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex shrink-0 items-center gap-2 h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 self-start"
        >
          <Maximize2 className="h-4 w-4" /> View all
        </button>
      </div>

      <div className="-mx-4 mt-8 overflow-x-auto px-4">
        <div className="flex gap-5 pb-2">
          {data.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => openProject(p.id)}
              className="w-[300px] shrink-0"
            />
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
              <h3 className="text-lg font-semibold">
                All projects ({filteredAllProjects.length}
                {filteredAllProjects.length !== data.length ? ` of ${data.length}` : ""})
              </h3>
              <button
                onClick={() => setShowAll(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={allSearch}
                  onChange={(e) => setAllSearch(e.target.value)}
                  placeholder="Search title, location, service…"
                  className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
                />
              </div>
              {allServiceOptions.length > 0 && (
                <select
                  value={allServiceFilter}
                  onChange={(e) => setAllServiceFilter(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">All services</option>
                  {allServiceOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
              {allStatusOptions.length > 0 && (
                <select
                  value={allStatusFilter}
                  onChange={(e) => setAllStatusFilter(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">All statuses</option>
                  {allStatusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={allSizeFilter}
                onChange={(e) => setAllSizeFilter(e.target.value as "" | "major" | "small")}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">All project sizes</option>
                <option value="major">Major projects</option>
                <option value="small">Small projects</option>
              </select>
              <select
                value={allSortKey}
                onChange={(e) => setAllSortKey(e.target.value as ProjectViewAllSortKey)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {Object.entries(PROJECT_VIEW_ALL_SORT_OPTIONS).map(([key, opt]) => (
                  <option key={key} value={key}>
                    Sort: {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {filteredAllProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects match your search or filter.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAllProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} onClick={() => openProject(p.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={closeProject}
        >
          <div
            className={`flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl transition-[max-height] duration-200 ${
              expanded ? "max-h-[95vh]" : "max-h-[85vh]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {(selected.photo_urls?.length ?? 0) > 0 && (
              <div className="shrink-0 rounded-t-2xl bg-muted p-2">
                <MediaRow
                  media={selected.photo_urls.map((url) => ({
                    url,
                    type: "image" as const,
                    position: selected.photo_positions?.[url],
                  }))}
                  altText={selected.title}
                  heightClass={expanded ? "h-96" : "h-40"}
                />
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col p-6">
              <div className="shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="text-xl font-bold">{selected.title}</h3>
                    <ProjectStatusBadge status={selected.inquiry_status} />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setExpanded((v) => !v)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label={expanded ? "Shrink" : "Expand"}
                      title={expanded ? "Shrink" : "Expand"}
                    >
                      {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={closeProject}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {selected.location && (
                  <div className="text-sm text-muted-foreground">{selected.location}</div>
                )}
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
                  {selected.services?.length > 0 ? selected.services.join(", ") : selected.service}
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
              </div>
              {selected.media?.length > 0 && (
                <div className="mt-5 flex min-h-0 flex-1 flex-col">
                  <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Photos &amp; videos
                  </p>
                  <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                    <MediaRow
                      media={selected.media.map((m) => ({
                        url: m.url,
                        type: m.media_type === "video" ? "video" : "image",
                      }))}
                      altText={selected.title}
                      onItemClick={(i) => openMedia(selected.media, i)}
                      expandedFillParent
                    />
                  </div>
                </div>
              )}
              {selected.attachments?.length > 0 && (
                <div className="mt-5 shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Files
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selected.attachments.map((a, i) => (
                      <button
                        key={a.path}
                        type="button"
                        onClick={() => openAttachments(selected.attachments, i)}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm hover:bg-muted"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{a.name}</span>
                      </button>
                    ))}
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

function FlatLightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xl"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        ×
      </button>
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-2xl"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        aria-label="Previous"
      >
        ‹
      </button>
      {items[index].type === "video" ? (
        <video
          src={items[index].url}
          controls
          autoPlay
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={items[index].url}
          alt={`Gallery item ${index + 1}`}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-2xl"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        aria-label="Next"
      >
        ›
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        {index + 1} / {items.length}
      </div>
    </div>
  );
}

function GalleryFolderCard({
  folder,
  onOpen,
}: {
  folder: PublicGalleryFolder;
  onOpen: () => void;
}) {
  const cover = folder.items.find((it) => it.media_type === "photo") ?? folder.items[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-video overflow-hidden bg-muted flex items-center justify-center">
        {cover ? (
          cover.media_type === "video" ? (
            <div className="relative h-full w-full">
              <video
                src={cover.url}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                  <Play className="h-4 w-4 fill-slate-900 text-slate-900" />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={cover.url}
              alt={folder.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          )
        ) : (
          <Folder className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold">{folder.name}</h4>
          <span className="shrink-0 text-xs text-muted-foreground">
            {folder.items.length} item{folder.items.length === 1 ? "" : "s"}
          </span>
        </div>
        {(folder.location || folder.date_start) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {folder.location}
            <ProjectDateRange p={{ start_date: folder.date_start, end_date: folder.date_end }} />
          </p>
        )}
        {folder.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
            {folder.description}
          </p>
        )}
      </div>
    </button>
  );
}

function Photos() {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openFolder, setOpenFolder] = useState<PublicGalleryFolder | null>(null);
  const [folderLightbox, setFolderLightbox] = useState<number | null>(null);
  const [folderSearch, setFolderSearch] = useState("");
  const [folderLocationFilter, setFolderLocationFilter] = useState("");
  const [folderSortKey, setFolderSortKey] = useState<"newest" | "oldest" | "name">("newest");
  const [openFolderSearch, setOpenFolderSearch] = useState("");
  const [openFolderTypeFilter, setOpenFolderTypeFilter] = useState<"all" | "photo" | "video">(
    "all",
  );
  const { data } = usePublicGalleryPhotos();
  const { data: folderData } = usePublicGalleryFolders();
  const folders = folderData ?? [];
  const folderLocationOptions = Array.from(
    new Set(folders.map((f) => f.location).filter((l): l is string => Boolean(l))),
  ).sort();
  const folderSearchLower = folderSearch.trim().toLowerCase();
  const filteredFolders = folders
    .filter((f) => {
      if (folderLocationFilter && f.location !== folderLocationFilter) return false;
      if (!folderSearchLower) return true;
      return [f.name, f.location, f.description]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(folderSearchLower));
    })
    .sort((a, b) => {
      if (folderSortKey === "name") return a.name.localeCompare(b.name);
      const da = a.date_start ?? "";
      const db = b.date_start ?? "";
      return folderSortKey === "oldest" ? da.localeCompare(db) : db.localeCompare(da);
    });
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

  function closeAll() {
    setShowAll(false);
    setOpenFolder(null);
    setFolderSearch("");
    setFolderLocationFilter("");
    setFolderSortKey("newest");
  }

  function openFolderView(f: PublicGalleryFolder) {
    setOpenFolder(f);
    setOpenFolderSearch("");
    setOpenFolderTypeFilter("all");
  }

  const openFolderSearchLower = openFolderSearch.trim().toLowerCase();
  const filteredFolderPhotos = openFolder
    ? openFolder.items.filter((p) => {
        if (openFolderTypeFilter !== "all" && p.media_type !== openFolderTypeFilter) return false;
        if (!openFolderSearchLower) return true;
        return (p.caption ?? "").toLowerCase().includes(openFolderSearchLower);
      })
    : [];
  const folderItems: GalleryItem[] = filteredFolderPhotos.map((p) => ({
    url: p.url,
    name: p.id,
    type: p.media_type,
  }));
  const closeFolderLightbox = () => setFolderLightbox(null);
  const prevFolder = () =>
    setFolderLightbox((i) =>
      i === null ? null : (i - 1 + folderItems.length) % folderItems.length,
    );
  const nextFolder = () =>
    setFolderLightbox((i) => (i === null ? null : (i + 1) % folderItems.length));

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
          onClick={closeAll}
        >
          <div
            className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-card p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {openFolder ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <button
                    onClick={() => setOpenFolder(null)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label="Back to folders"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold">{openFolder.name}</h3>
                    {(openFolder.location || openFolder.date_start) && (
                      <p className="text-xs text-muted-foreground">
                        {openFolder.location}
                        <ProjectDateRange
                          p={{ start_date: openFolder.date_start, end_date: openFolder.date_end }}
                        />
                      </p>
                    )}
                  </div>
                  <button
                    onClick={closeAll}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {openFolder.description && (
                  <p className="mb-4 text-sm text-muted-foreground">{openFolder.description}</p>
                )}
                <div className="mb-4 flex flex-wrap gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={openFolderSearch}
                      onChange={(e) => setOpenFolderSearch(e.target.value)}
                      placeholder="Search caption…"
                      className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
                    />
                  </div>
                  <select
                    value={openFolderTypeFilter}
                    onChange={(e) =>
                      setOpenFolderTypeFilter(e.target.value as "all" | "photo" | "video")
                    }
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="all">Photos + videos</option>
                    <option value="photo">Photos only</option>
                    <option value="video">Videos only</option>
                  </select>
                </div>
                {folderItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {openFolder.items.length === 0
                      ? "No photos or videos in this folder yet."
                      : "No items match your search or filter."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {folderItems.map((item, i) => (
                      <GalleryThumb
                        key={item.name}
                        item={item}
                        index={i}
                        onOpen={setFolderLightbox}
                        alt={`${openFolder.name} item ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">
                    Gallery folders ({filteredFolders.length}
                    {filteredFolders.length !== folders.length ? ` of ${folders.length}` : ""})
                  </h3>
                  <button
                    onClick={closeAll}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {folders.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={folderSearch}
                        onChange={(e) => setFolderSearch(e.target.value)}
                        placeholder="Search name, location, description…"
                        className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
                      />
                    </div>
                    {folderLocationOptions.length > 0 && (
                      <select
                        value={folderLocationFilter}
                        onChange={(e) => setFolderLocationFilter(e.target.value)}
                        className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                      >
                        <option value="">All locations</option>
                        {folderLocationOptions.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={folderSortKey}
                      onChange={(e) =>
                        setFolderSortKey(e.target.value as "newest" | "oldest" | "name")
                      }
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="newest">Sort: Newest first</option>
                      <option value="oldest">Sort: Oldest first</option>
                      <option value="name">Sort: Name A-Z</option>
                    </select>
                  </div>
                )}
                {folders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No folders yet.</p>
                ) : filteredFolders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No folders match your search.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredFolders.map((f) => (
                      <GalleryFolderCard key={f.id} folder={f} onOpen={() => openFolderView(f)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {lightbox !== null && (
        <FlatLightbox
          items={galleryItems}
          index={lightbox}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
      {folderLightbox !== null && (
        <FlatLightbox
          items={folderItems}
          index={folderLightbox}
          onClose={closeFolderLightbox}
          onPrev={prevFolder}
          onNext={nextFolder}
        />
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
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <img src={logo} alt="KL2J logo" className="h-6 w-6 rounded-full object-cover" />
            KL2J Land Surveying and Engineering Services
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
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
        </div>
        <div className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} KL2J Land Surveying and Engineering Services. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
