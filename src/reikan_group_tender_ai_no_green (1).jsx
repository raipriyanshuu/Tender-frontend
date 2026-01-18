import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  AlertTriangle,
  FileText,
  Search,
  Upload,
  ChevronRight,
  Wand2,
  Plus,
  Trash2,
  Info,
  ArrowRight,
  Truck,
  Recycle,
  Fuel,
  MapPin,
  Link as LinkIcon,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

// ---------------- Types
interface Tender {
  id: string;
  title: string;
  buyer: string;
  region: string;
  deadline: string; // ISO
  url: string;
  score: number; // overall match score 0..100
  legalRisks: string[];
  mustHits: number;
  mustTotal: number;
  canHits: number;
  canTotal: number;
  wasteStreams: string[]; // e.g., Mineralik, Kunststoff
}

interface CompanyProfile {
  name: string;
  address: string;
  vatId: string;
  permits: string[];
  fleet: string;
  insurance: string;
  contactName: string;
  contactEmail: string;
  depotPostcode?: string;
  disposalSites?: string; // contracted plants
}

interface DocItem {
  id: string;
  name: string;
  status: "present" | "missing" | "needs_update";
  notes?: string;
}

interface PricingInput {
  pickupsPerWeek: number; // average across sites
  weeksPerMonth: number; // typically 4.3
  distanceKm: number; // depot → route centroid one way
  tonnagePerMonth: number; // total mixed
  disposalFeePerTonne: number; // €
  costPerKm: number; // € all-in truck cost
  liftFeesPerMonth: number; // € container handling, flat
  fuelSurchargePct: number; // %
  marginPct: number; // %
}

// ---------------- Questions tuned to REIKAN scopes
const REQUIRED_Q: { id: string; label: string; hint?: string }[] = [
  { id: "streams", label: "Stoffströme & Anteile (Mineralik, Kunststoff, Aluminium)" },
  { id: "serviceWindows", label: "Zeitfenster / Zufahrten / Schulzonen" },
  { id: "handoverPoints", label: "Übergabestellen / Anlagen (SN/BB)" },
  { id: "rcQuote", label: "RC-Quote / DIN/QRB Vorgaben" },
  { id: "specials", label: "Besonderheiten (Altlast, Bodenwäsche, Pyrolyse)" },
];

// ---------------- Mock data (Saxony focus)
const MOCK_TENDERS: Tender[] = [
  {
    id: "t-sn-201",
    title: "Kommunale Sammlung und Verwertung – Los Dresden West",
    buyer: "Landeshauptstadt Dresden",
    region: "DE-SN",
    deadline: "2025-12-05",
    url: "https://example.com/tenders/sn-201",
    score: 86,
    legalRisks: ["Tariftreueerklärung", "EfbV-Nachweis jährlich", "Nachunternehmerquote max. 20%"],
    mustHits: 9,
    mustTotal: 10,
    canHits: 11,
    canTotal: 16,
    wasteStreams: ["Mineralik", "PPK"],
  },
  {
    id: "t-sn-202",
    title: "Mineralische Abfälle: Aufbereitung/Verwertung – Region Leipzig",
    buyer: "Stadt Leipzig / Stadtreinigung",
    region: "DE-SN",
    deadline: "2025-11-29",
    url: "https://example.com/tenders/sn-202",
    score: 78,
    legalRisks: ["RC-Quote Nachweis", "Frist Bieterfragen 2025-11-20", "Transportlizenz EU"],
    mustHits: 8,
    mustTotal: 10,
    canHits: 10,
    canTotal: 15,
    wasteStreams: ["Mineralik", "Bauschutt"],
  },
  {
    id: "t-sn-203",
    title: "Kunststoff-Recycling & Sekundärrohstoffe – ZAOE",
    buyer: "Zweckverband Abfallwirtschaft Oberes Elbtal (ZAOE)",
    region: "DE-SN",
    deadline: "2025-12-12",
    url: "https://example.com/tenders/sn-203",
    score: 81,
    legalRisks: ["Verwertungswege Nachweis", "ADR-Schulung für Spezialfraktionen"],
    mustHits: 8,
    mustTotal: 10,
    canHits: 12,
    canTotal: 16,
    wasteStreams: ["Kunststoff", "Sekundärrohstoffe"],
  },
];

const DEFAULT_PROFILE: CompanyProfile = {
  name: "REIKAN GROUP",
  address: "Gottfried-Keller-Str. 16, 01157 Dresden",
  vatId: "",
  permits: ["§ 54 KrWG", "EfbV-Zertifikat", "EU-Transportlizenz"],
  fleet: "Standorte in Dresden, Leipzig, Freiberg; LKW-Flotte für Mineralik- und Kunststofflogistik",
  insurance: "Betriebshaftpflicht vorhanden",
  contactName: "Reikan Team",
  contactEmail: "info@reikan.de",
  depotPostcode: "01157",
  disposalSites: "Freiberg (Pyrolyse/Aluminium), regionale Anlagen in SN/BB",
};

const DEFAULT_DOCS: DocItem[] = [
  { id: "d-001", name: "EfbV-Zertifikat (Entsorgungsfachbetrieb)", status: "present" },
  { id: "d-002", name: "Unbedenklichkeitsbescheinigung Finanzamt", status: "needs_update", notes: "älter als 12 Monate" },
  { id: "d-003", name: "Zuverlässigkeitsnachweis §53/54 KrWG", status: "missing" },
  { id: "d-004", name: "Versicherungsnachweis", status: "present" },
  { id: "d-005", name: "Referenzliste Projekte (3 Jahre)", status: "needs_update", notes: "nur 1 Referenz vorhanden" },
  { id: "d-006", name: "ADR-Schulungsnachweise", status: "present" },
];

const DEFAULT_PRICING: PricingInput = {
  pickupsPerWeek: 3,
  weeksPerMonth: 4.3,
  distanceKm: 18,
  tonnagePerMonth: 120,
  disposalFeePerTonne: 125,
  costPerKm: 1.9,
  liftFeesPerMonth: 1800,
  fuelSurchargePct: 6,
  marginPct: 12,
};

// ---------------- Utils
const pct = (hits: number, total: number) => (total === 0 ? 0 : Math.round((100 * hits) / total));

function euro(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function computeWinProbability(
  tender: Tender | null,
  missingCount: number,
  answers: Record<string, string>,
  mustPct: number
): number {
  if (!tender) return 0;
  const docPenalty = missingCount * 4; // -4% each issue
  const qMissing = REQUIRED_Q.filter((q) => !(answers[q.id]?.trim())).length;
  const qPenalty = qMissing * 3;
  const base = Math.max(0, tender.score - docPenalty - qPenalty);
  const mustBoost = Math.round(mustPct * 0.2);
  return Math.max(1, Math.min(99, Math.round((base + mustBoost) * 0.9 + 5)));
}

function routeFeasibilityScore(distanceKm: number, pickupsPerWeek: number, fleetStr: string) {
  const heavyFleet = /Presswagen|Hakenlift|26t/i.test(fleetStr) ? 1 : 0;
  const distancePenalty = Math.max(0, distanceKm - 25) * 0.8; // soft cap 25 km one-way
  const freqPenalty = Math.max(0, pickupsPerWeek - 4) * 2; // >4/w weakens
  const raw = 100 - distancePenalty - freqPenalty + heavyFleet * 5;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ---------------- Root
export default function ReikanTenderAI() {
  const [step, setStep] = useState<number>(1);
  const [query, setQuery] = useState<string>("");
  const [sortKey, setSortKey] = useState<"deadline" | "score">("deadline");
  const [results] = useState<Tender[]>(MOCK_TENDERS);
  const [selected, setSelected] = useState<Tender | null>(MOCK_TENDERS[0]);
  const [profile, setProfile] = useState<CompanyProfile>(DEFAULT_PROFILE);
  const [docs, setDocs] = useState<DocItem[]>(DEFAULT_DOCS);
  const [pricing, setPricing] = useState<PricingInput>(DEFAULT_PRICING);
  const [autoFill, setAutoFill] = useState<boolean>(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [aiEdits, setAiEdits] = useState<Record<string, string>>({});
  const [riskAccepted, setRiskAccepted] = useState<boolean>(false);
  const [showTests, setShowTests] = useState<boolean>(false);

  // keyboard step nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(8, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(1, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mustPct = useMemo(() => pct(selected?.mustHits ?? 0, selected?.mustTotal ?? 0), [selected]);
  const canPct = useMemo(() => pct(selected?.canHits ?? 0, selected?.canTotal ?? 0), [selected]);
  const missingCount = useMemo(() => docs.filter((d) => d.status !== "present").length, [docs]);
  const routeScore = useMemo(
    () => routeFeasibilityScore(pricing.distanceKm, pricing.pickupsPerWeek, profile.fleet),
    [pricing, profile.fleet]
  );

  const winProb = useMemo(() => computeWinProbability(selected, missingCount, answers, mustPct), [selected, missingCount, answers, mustPct]);

  const { subtotal, surcharge, margin, total } = useMemo(() => calcPrice(pricing), [pricing]);

  const Steps = [
    { id: 1, title: "Scan", desc: "Scan tenders" },
    { id: 2, title: "Criteria", desc: "Must/Can + Risks" },
    { id: 3, title: "Company", desc: "Company data" },
    { id: 4, title: "Q&A", desc: "Complementary Q" },
    { id: 5, title: "Docs", desc: "Docs & alerts" },
    { id: 6, title: "Pricing", desc: "Waste pricing" },
    { id: 7, title: "Edit", desc: "AI edits & gaps" },
    { id: 8, title: "Summary", desc: "Exec + win %" },
  ];

  const handleUpload = (files: FileList | null) => {
    if (!files) return;
    const updates: DocItem[] = [];
    Array.from(files).forEach((f, idx) => {
      updates.push({ id: `u-${Date.now()}-${idx}`, name: f.name, status: "present" });
    });
    setDocs((prev) => [...prev, ...updates]);
  };

  const setDocStatus = (id: string, status: DocItem["status"]) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  };

  // simple search + sort mock
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = MOCK_TENDERS.filter(
      (t) => !q || `${t.title} ${t.buyer} ${t.region} ${t.wasteStreams.join(" ")}`.toLowerCase().includes(q)
    );
    const sorted = [...pool].sort((a, b) => {
      if (sortKey === "deadline") return +new Date(a.deadline) - +new Date(b.deadline);
      return b.score - a.score;
    });
    return sorted;
  }, [query, sortKey]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-white p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Truck className="h-6 w-6" /> Reikan Group · Tender AI
            </h1>
            <p className="text-sm text-zinc-500">Saxony · Dresden · Find · Score · Price · Draft</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={autoFill} onCheckedChange={setAutoFill} aria-label="AI autofill" />
            <span className="text-sm text-zinc-600">AI autofill</span>
          </div>
        </header>

        {/* Stepper */}
        <ol className="mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {Steps.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setStep(s.id)}
                className={`w-full rounded-2xl border p-3 text-left focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${
                  step === s.id ? "border-zinc-900 bg-white shadow" : "border-zinc-200 bg-zinc-50 hover:bg-white"
                }`}
                aria-current={step === s.id ? "step" : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">{s.title}</span>
                  {step > s.id ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 opacity-60" />}
                </div>
                <p className="mt-1 text-sm text-zinc-500">{s.desc}</p>
              </button>
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {step === 1 && (
              <StepScan
                query={query}
                setQuery={setQuery}
                results={filtered}
                selected={selected}
                setSelected={setSelected}
                onNext={() => setStep(2)}
                sortKey={sortKey}
                setSortKey={setSortKey}
              />
            )}
            {step === 2 && selected && <StepCriteria tender={selected} routeScore={routeScore} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
            {step === 3 && (
              <StepCompany profile={profile} setProfile={setProfile} autoFill={autoFill} onNext={() => setStep(4)} onBack={() => setStep(2)} />
            )}
            {step === 4 && (
              <StepQA requiredQ={REQUIRED_Q} answers={answers} setAnswers={setAnswers} onNext={() => setStep(5)} onBack={() => setStep(3)} />
            )}
            {step === 5 && (
              <StepDocs docs={docs} setDocStatus={setDocStatus} onUpload={handleUpload} onNext={() => setStep(6)} onBack={() => setStep(4)} />
            )}
            {step === 6 && <StepPricing pricing={pricing} setPricing={setPricing} onNext={() => setStep(7)} onBack={() => setStep(5)} />}
            {step === 7 && <StepEdit docs={docs} aiEdits={aiEdits} setAiEdits={setAiEdits} onNext={() => setStep(8)} onBack={() => setStep(6)} />}
            {step === 8 && selected && (
              <StepSummary
                tender={selected}
                profile={profile}
                docs={docs}
                answers={answers}
                winProb={winProb}
                riskAccepted={riskAccepted}
                setRiskAccepted={setRiskAccepted}
                onBack={() => setStep(7)}
                pricing={{ subtotal, surcharge, margin, total }}
                routeScore={routeScore}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky Step Controls */}
        <div className="sticky bottom-4 mt-8 flex justify-center">
          <div className="flex items-center gap-2 rounded-2xl border bg-white/90 p-2 shadow backdrop-blur">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))}>Back</Button>
            <div className="h-6 w-px bg-zinc-200" />
            <Button onClick={() => setStep((s) => Math.min(8, s + 1))}>Next</Button>
          </div>
        </div>

        {/* Dev tests toggle */}
        <div className="mt-8 flex items-center justify-between rounded-2xl border p-4">
          <div>
            <div className="text-sm font-medium">Developer Tests</div>
            <div className="text-xs text-zinc-500">Toggle to view inline test results for win probability logic.</div>
          </div>
          <Switch checked={showTests} onCheckedChange={setShowTests} />
        </div>
        {showTests && <DevTests />}
      </div>
    </div>
  );
}

// ---------------- Step 1
function StepScan({
  query,
  setQuery,
  results,
  selected,
  setSelected,
  onNext,
  sortKey,
  setSortKey,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Tender[];
  selected: Tender | null;
  setSelected: (t: Tender) => void;
  onNext: () => void;
  sortKey: "deadline" | "score";
  setSortKey: (k: "deadline" | "score") => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="inline-flex items-center gap-2"><Search className="h-5 w-5" />Scan for Matching Tenders</span>
            <Button variant="ghost" size="sm" className="gap-2" aria-label="Search options" title="Search options">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keywords, region, buyer, waste stream" aria-label="Search tenders" />
          <div className="flex gap-2">
            <Button variant="secondary" className="w-full">Import URLs</Button>
            <Button className="w-full">
              <Wand2 className="mr-2 h-4 w-4" />AI Find
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>Sort by</span>
            <div className="inline-flex gap-1 rounded-xl border p-1">
              <button
                onClick={() => setSortKey("deadline")}
                className={`rounded-lg px-2 py-1 ${sortKey === "deadline" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
              >
                Deadline
              </button>
              <button
                onClick={() => setSortKey("score")}
                className={`rounded-lg px-2 py-1 ${sortKey === "score" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
              >
                Score
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500">Paste links from eVergabe, Subreport, TED. System extracts buyer, lot, deadline, streams.</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {results.length === 0 && (
            <div className="rounded-2xl border p-6 text-sm text-zinc-600">No tenders match your filters.</div>
          )}
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`group w-full rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${
                selected?.id === t.id ? "border-zinc-900 bg-white shadow" : "border-zinc-200 bg-zinc-50 hover:bg-white"
              }`}
              aria-pressed={selected?.id === t.id}
            >
              <div className="grid grid-cols-12 items-start gap-3">
                {/* Meta column */}
                <div className="col-span-12 md:col-span-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-medium" title={t.title}>{t.title}</h3>
                    <Badge variant="secondary">{t.region === 'DE-SN' ? 'Saxony' : t.region}</Badge>
                    {t.wasteStreams?.map((s, i) => (
                      <Badge key={i} className="bg-sky-100 text-sky-900">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-zinc-600">
                    {t.buyer} · Due {new Date(t.deadline).toLocaleDateString()}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <ScorePill label="Must" value={pct(t.mustHits, t.mustTotal)} />
                    <ScorePill label="Can" value={pct(t.canHits, t.canTotal)} />
                    <ScorePill label="Overall" value={t.score} />
                  </div>
                </div>

                {/* Side column */}
                <div className="col-span-12 md:col-span-4 md:text-right">
                  <RiskList risks={t.legalRisks} />
                  <div className="mt-3 flex items-center gap-2 md:justify-end">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-xs hover:bg-zinc-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LinkIcon className="h-3.5 w-3.5" /> Open
                    </a>
                    <Button size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); onNext(); }}>
                      Next <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 2
function StepCriteria({ tender, routeScore, onNext, onBack }: { tender: Tender; routeScore: number; onNext: () => void; onBack: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Must & Can Criteria</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
            <Metric title="Must Match" value={`${pct(tender.mustHits, tender.mustTotal)}%`} caption={`${tender.mustHits}/${tender.mustTotal}`} />
            <Metric title="Can Match" value={`${pct(tender.canHits, tender.canTotal)}%`} caption={`${tender.canHits}/${tender.canTotal}`} />
            <Metric title="Overall" value={`${tender.score}%`} caption="Weighted" />
            <Metric title="Route Fit" value={`${routeScore}%`} caption="Distance/Frequency" />
          </div>
          <Separator />
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Legal & Compliance Risks</h4>
            <RiskList risks={tender.legalRisks} large />
            <ul className="mt-2 grid gap-1 text-xs text-zinc-600">
              <li>• Tariftreue + Mindestlohn</li>
              <li>• EfbV / KrWG Nachweise aktuell</li>
              <li>• Arbeitszeit bei Nacht- und Schulzonen</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full">
            <Wand2 className="mr-2 h-4 w-4" />Improve Score
          </Button>
          <Button variant="secondary" className="w-full">
            Explain Weights
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
            <Button onClick={onNext} className="w-full">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 3
function StepCompany({ profile, setProfile, autoFill, onNext, onBack }: { profile: CompanyProfile; setProfile: (p: CompanyProfile) => void; autoFill: boolean; onNext: () => void; onBack: () => void }) {
  const update = (k: keyof CompanyProfile, v: string | string[] | undefined) => setProfile({ ...profile, [k]: v } as CompanyProfile);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Company Data {autoFill && <Badge className="ml-2" variant="secondary">AI filled</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LabeledInput label="Company Name" value={profile.name} onChange={(v) => update("name", v)} />
            <LabeledInput label="VAT ID" value={profile.vatId} onChange={(v) => update("vatId", v)} />
          </div>
          <LabeledInput label="Address" value={profile.address} onChange={(v) => update("address", v)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LabeledInput label="Fleet" value={profile.fleet} onChange={(v) => update("fleet", v)} />
            <LabeledInput label="Insurance" value={profile.insurance} onChange={(v) => update("insurance", v)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <LabeledInput label="Depot Postcode" value={profile.depotPostcode || ""} onChange={(v) => update("depotPostcode", v)} />
            <LabeledInput label="Disposal Sites" value={profile.disposalSites || ""} onChange={(v) => update("disposalSites", v)} />
            <LabeledInput label="Contact Email" value={profile.contactEmail} onChange={(v) => update("contactEmail", v)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LabeledInput label="Contact Name" value={profile.contactName} onChange={(v) => update("contactName", v)} />
            <TagEditor label="Permits" tags={profile.permits} onChange={(tags) => update("permits", tags)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full">
            <Wand2 className="mr-2 h-4 w-4" />Autofill from Dataroom
          </Button>
          <Button variant="secondary" className="w-full">
            Validate Consistency
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
            <Button onClick={onNext} className="w-full">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 4
function StepQA({ requiredQ, answers, setAnswers, onNext, onBack }: { requiredQ: { id: string; label: string; hint?: string }[]; answers: Record<string, string>; setAnswers: (r: Record<string, string>) => void; onNext: () => void; onBack: () => void }) {
  const set = (k: string, v: string) => setAnswers({ ...answers, [k]: v });
  const missing = requiredQ.filter((q) => !(answers[q.id]?.trim())).length;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Answer Complementary Questions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {requiredQ.map((q) => (
            <div key={q.id} className="grid gap-2">
              <label className="text-sm font-medium">{q.label}</label>
              <Textarea value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} placeholder="Type your answer or ask AI to draft" />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  <Wand2 className="mr-1 h-4 w-4" />AI Draft
                </Button>
                <Button variant="ghost" size="sm">
                  Use Template
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-zinc-600">Missing answers: {missing}</div>
          <Progress value={Math.round(((requiredQ.length - missing) / requiredQ.length) * 100)} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
            <Button onClick={onNext} className="w-full">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 5
function StepDocs({ docs, setDocStatus, onUpload, onNext, onBack }: { docs: DocItem[]; setDocStatus: (id: string, s: DocItem["status"]) => void; onUpload: (files: FileList | null) => void; onNext: () => void; onBack: () => void }) {
  const missing = docs.filter((d) => d.status !== "present");
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Gather Relevant Documents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {docs.map((d) => (
            <div key={d.id} className="flex items-start justify-between rounded-xl border p-3">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{d.name}</span>
                    {d.status === "present" && <Badge variant="secondary">present</Badge>}
                    {d.status === "needs_update" && <Badge className="bg-yellow-100 text-yellow-900">needs update</Badge>}
                    {d.status === "missing" && <Badge className="bg-red-100 text-red-900">missing</Badge>}
                  </div>
                  {d.notes && <p className="text-xs text-zinc-500">{d.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDocStatus(d.id, "present")}>
                  Mark present
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDocStatus(d.id, "needs_update")}> 
                  Needs update
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDocStatus(d.id, "missing")}> 
                  Missing
                </Button>
              </div>
            </div>
          ))}
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border p-2 px-3 text-sm hover:bg-zinc-50">
                <Upload className="h-4 w-4" />
                <span>Upload files</span>
                <input type="file" className="hidden" multiple onChange={(e) => onUpload(e.target.files)} />
              </label>
              <Button variant="secondary">
                <Wand2 className="mr-2 h-4 w-4" />Fetch from Dataroom
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {missing.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-sky-700">
              <Check className="h-4 w-4" />All good
            </div>
          ) : (
            missing.map((m) => (
              <div key={m.id} className="flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4" /> {m.name} {m.status === "missing" ? "is missing" : m.notes || "needs update"}
              </div>
            ))
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
            <Button onClick={onNext} className="w-full">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 6: Pricing for waste + quick presets
function calcPrice(p: PricingInput) {
  const tripsPerMonth = p.pickupsPerWeek * p.weeksPerMonth;
  const transport = tripsPerMonth * (p.distanceKm * 2) * p.costPerKm;
  const disposal = p.tonnagePerMonth * p.disposalFeePerTonne;
  const ops = p.liftFeesPerMonth;
  const subtotal = transport + disposal + ops;
  const surcharge = (subtotal * p.fuelSurchargePct) / 100;
  const margin = ((subtotal + surcharge) * p.marginPct) / 100;
  const total = Math.round(subtotal + surcharge + margin);
  return { subtotal, surcharge, margin, total, transport, disposal, ops };
}

function StepPricing({ pricing, setPricing, onNext, onBack }: { pricing: PricingInput; setPricing: (p: PricingInput) => void; onNext: () => void; onBack: () => void }) {
  const { subtotal, surcharge, margin, total, transport, disposal, ops } = useMemo(() => calcPrice(pricing), [pricing]);
  const set = (k: keyof PricingInput, v: number) => setPricing({ ...pricing, [k]: v });

  const applyPreset = (preset: "lean" | "standard" | "rich") => {
    if (preset === "lean") setPricing({ ...pricing, fuelSurchargePct: 4, marginPct: 8 });
    if (preset === "standard") setPricing({ ...pricing, fuelSurchargePct: 6, marginPct: 12 });
    if (preset === "rich") setPricing({ ...pricing, fuelSurchargePct: 8, marginPct: 18 });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Recycle className="h-4 w-4" />Pricing – Waste Ops
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NumInput label="Pickups / week" value={pricing.pickupsPerWeek} onChange={(n) => set("pickupsPerWeek", n)} />
            <NumInput label="Weeks / month" value={pricing.weeksPerMonth} onChange={(n) => set("weeksPerMonth", n)} />
            <NumInput label="One-way distance (km)" value={pricing.distanceKm} onChange={(n) => set("distanceKm", n)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NumInput label="Tonnage / month" value={pricing.tonnagePerMonth} onChange={(n) => set("tonnagePerMonth", n)} />
            <NumInput label="Disposal fee €/t" value={pricing.disposalFeePerTonne} onChange={(n) => set("disposalFeePerTonne", n)} />
            <NumInput label="Truck cost €/km" value={pricing.costPerKm} onChange={(n) => set("costPerKm", n)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NumInput label="Lift fees / month" value={pricing.liftFeesPerMonth} onChange={(n) => set("liftFeesPerMonth", n)} />
            <NumInput label="Fuel surcharge %" value={pricing.fuelSurchargePct} onChange={(n) => set("fuelSurchargePct", n)} />
            <NumInput label="Margin %" value={pricing.marginPct} onChange={(n) => set("marginPct", n)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Quick presets:</span>
            <Button variant="secondary" size="sm" onClick={() => applyPreset("lean")}>Lean</Button>
            <Button variant="secondary" size="sm" onClick={() => applyPreset("standard")}>Standard</Button>
            <Button variant="secondary" size="sm" onClick={() => applyPreset("rich")}>Rich</Button>
          </div>

          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric title="Transport" value={euro(transport)} caption="km × trips" />
            <Metric title="Disposal" value={euro(disposal)} caption="€/t × t" />
            <Metric title="Ops" value={euro(ops)} caption="lifts" />
            <Metric title="Subtotal" value={euro(subtotal)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Metric title="Surcharge" value={euro(surcharge)} caption="fuel" />
            <Metric title="Margin" value={euro(margin)} />
            <Metric title="Total / month" value={euro(total)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full">
            <Fuel className="mr-2 h-4 w-4" />Auto-calc fuel index
          </Button>
          <Button variant="secondary" className="w-full">
            <MapPin className="mr-2 h-4 w-4" />Estimate distance
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
            <Button onClick={onNext} className="w-full">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 7
function StepEdit({ docs, aiEdits, setAiEdits, onNext, onBack }: { docs: DocItem[]; aiEdits: Record<string, string>; setAiEdits: (r: Record<string, string>) => void; onNext: () => void; onBack: () => void }) {
  const editable = docs.filter((d) => d.status !== "missing");
  const set = (k: string, v: string) => setAiEdits({ ...aiEdits, [k]: v });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">AI Edit Documents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {editable.map((d) => (
            <div key={d.id} className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary">
                    <Wand2 className="mr-2 h-4 w-4" />Improve
                  </Button>
                  <Button size="sm" variant="ghost">Download</Button>
                </div>
              </div>
              <Textarea rows={6} placeholder="AI will propose edits here" value={aiEdits[d.id] ?? ""} onChange={(e) => set(d.id, e.target.value)} />
            </div>
          ))}
          <div className="rounded-xl border p-4 text-sm text-zinc-600">
            <div className="mb-1 flex items-center gap-2">
              <Info className="h-4 w-4" />Missing information
            </div>
            <ul className="list-disc pl-5">
              {docs
                .filter((d) => d.status !== "present")
                .map((d) => (
                  <li key={d.id}>
                    {d.name}: {d.status === "missing" ? "no file" : d.notes || "needs update"}
                  </li>
                ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full">
            <Wand2 className="mr-2 h-4 w-4" />Fill Gaps With Templates
          </Button>
          <Button variant="secondary" className="w-full">
            Compliance Check
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
            <Button onClick={onNext} className="w-full">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Step 8
function StepSummary({ tender, profile, docs, answers, winProb, riskAccepted, setRiskAccepted, onBack, pricing, routeScore }: { tender: Tender; profile: CompanyProfile; docs: DocItem[]; answers: Record<string, string>; winProb: number; riskAccepted: boolean; setRiskAccepted: (v: boolean) => void; onBack: () => void; pricing: { subtotal: number; surcharge: number; margin: number; total: number }; routeScore: number }) {
  const readyDocs = docs.filter((d) => d.status === "present").length;
  const totalDocs = docs.length;
  const unanswered = Object.keys(answers).filter((k) => !answers[k]?.trim()).length;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-xl border p-4">
            <div className="mb-1 text-sm text-zinc-500">Tender</div>
            <div className="text-sm font-medium">
              {tender.title} · {tender.buyer} · Due {new Date(tender.deadline).toLocaleDateString()}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric title="Win Probability" value={`${winProb}%`} caption="Heuristic" />
            <Metric title="Route Fit" value={`${routeScore}%`} caption="Ops feasibility" />
            <Metric title="Docs Ready" value={`${readyDocs}/${totalDocs}`} caption="present" />
            <Metric title="Unanswered" value={`${unanswered}`} caption="questions" />
          </div>
          <Separator />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric title="Price Total / mo" value={euro(pricing.total)} caption="incl. surcharge + margin" />
            <Metric title="Subtotal" value={euro(pricing.subtotal)} />
            <Metric title="Surcharge" value={euro(pricing.surcharge)} />
            <Metric title="Margin" value={euro(pricing.margin)} />
          </div>
          <Separator />
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">Submission Checklist</h4>
            <ul className="grid gap-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Eligibility confirmed
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Documents packaged
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Pricing sheet attached
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Executive summary reviewed
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finalize</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <div className="text-sm font-medium">Accept Legal Risks</div>
              <div className="text-xs text-zinc-500">You acknowledge listed risks are mitigated.</div>
            </div>
            <Switch checked={riskAccepted} onCheckedChange={setRiskAccepted} />
          </div>
          <Button disabled={!riskAccepted} className="w-full">Generate Draft Offer PDF</Button>
          <Button variant="secondary" className="w-full">Export Data Room</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack} className="w-full">
              Back
            </Button>
            <Button className="w-full">Submit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Dev tests
function DevTests() {
  type T = {
    name: string;
    input: { tender: Tender | null; missing: number; answers: Record<string, string>; mustPct: number };
    expect: (n: number) => boolean;
  };

  const baseTender: Tender = {
    id: "x",
    title: "Demo",
    buyer: "Buyer",
    region: "DE-SN",
    deadline: "2025-12-31",
    url: "",
    score: 80,
    legalRisks: [],
    mustHits: 8,
    mustTotal: 10,
    canHits: 5,
    canTotal: 10,
    wasteStreams: ["Mineralik"],
  };

  const okAnswers = Object.fromEntries(REQUIRED_Q.map((q) => [q.id, "ok"]));

  const tests: T[] = [
    {
      name: "Null tender → 0",
      input: { tender: null, missing: 0, answers: {}, mustPct: 80 },
      expect: (n) => n === 0,
    },
    {
      name: "No penalties gives sensible range",
      input: { tender: baseTender, missing: 0, answers: okAnswers, mustPct: 80 },
      expect: (n) => n >= 1 && n <= 99,
    },
    {
      name: "Docs missing reduce probability",
      input: { tender: baseTender, missing: 5, answers: okAnswers, mustPct: 80 },
      expect: (n) => n < computeWinProbability(baseTender, 0, okAnswers, 80),
    },
    {
      name: "Unanswered questions reduce probability",
      input: { tender: baseTender, missing: 0, answers: {}, mustPct: 80 },
      expect: (n) => n < computeWinProbability(baseTender, 0, okAnswers, 80),
    },
    {
      name: "Must% contributes a boost",
      input: { tender: baseTender, missing: 0, answers: okAnswers, mustPct: 100 },
      expect: (n) => n >= computeWinProbability(baseTender, 0, okAnswers, 60),
    },
  ];

  const results = tests.map((t) => {
    const n = computeWinProbability(t.input.tender, t.input.missing, t.input.answers, t.input.mustPct);
    return { name: t.name, pass: t.expect(n), value: n };
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Test Results</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {results.map((r, i) => (
          <div key={i} className={`flex items-center justify-between rounded-lg border p-2 text-sm ${r.pass ? "" : "bg-red-50"}`}>
            <div>{r.name}</div>
            <div className={`inline-flex items-center gap-2 ${r.pass ? "text-sky-700" : "text-red-700"}`}>
              {r.pass ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span>{r.value}%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------- UI helpers
function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
      <span className="font-medium">{label}</span>
      <span className="opacity-70">{value}%</span>
    </span>
  );
}

function RiskList({ risks, large = false }: { risks: string[]; large?: boolean }) {
  if (!risks?.length) return <span className="text-xs text-zinc-400">No risks detected</span>;
  return (
    <div className={`grid ${large ? "gap-2" : "gap-1"}`}>
      {risks.map((r, i) => (
        <span key={i} className={`inline-flex items-center gap-2 ${large ? "text-sm" : "text-xs"} text-amber-700`}>
          <AlertTriangle className="h-4 w-4" />
          {r}
        </span>
      ))}
    </div>
  );
}

function Metric({ title, value, caption }: { title: string; value: string; caption?: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs text-zinc-500">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
      {caption && <div className="text-xs text-zinc-500">{caption}</div>}
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <label className="text-sm">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TagEditor({ label, tags, onChange }: { label: string; tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...(tags || []), v]);
    setDraft("");
  };
  const remove = (i: number) => onChange(tags.filter((_, idx) => idx !== i));
  return (
    <div className="grid gap-2">
      <label className="text-sm">{label}</label>
      <div className="flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
            {t}
            <button onClick={() => remove(i)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${t}`}>
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add permit" />
        <Button type="button" onClick={add}>
          <Plus className="mr-2 h-4 w-4" />Add
        </Button>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="grid gap-1">
      <label className="text-sm">{label}</label>
      <Input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value || "0"))} />
    </div>
  );
}
