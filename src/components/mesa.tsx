import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Clock,
  Columns3,
  ExternalLink,
  IdCard,
  Landmark,
  Layers,
  MapPin,
  Moon,
  Newspaper,
  Radio,
  Scale,
  Sun,
  Timer,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import {
  CALENDAR,
  CANDIDATES,
  CONGRESS,
  MAJORITY,
  PARTIES,
  POLLS,
  PROVINCES,
  READ_2023,
  RESULT_2023,
  RESULT_2023_META,
  RULES,
  SENATE_DIRECT,
  SOURCES,
  WING_ORDER,
  WINGS,
  calendarTone,
  countdownTarget,
  formatInt,
  formatPct,
  otherShare,
  phaseAt,
  pollSilence,
  resultByWing,
  seatLabel,
  slicesOf,
  sourceById,
  type Bi,
  type Kind,
  type Lang,
  type PartyId,
  type Phase,
  type Poll,
  type WingId,
} from "@/data/election";
import { LIVE_PINNED } from "@/data/live";
import type { LiveItem } from "@/lib/live/feeds";
import { useLiveFeed, type LiveFeed } from "@/lib/live/use-live-feed";
import type { Tab } from "@/lib/sections";

type Filter = "all" | Kind;
type Edition = "day" | "night";

const TABS: { id: Tab; icon: LucideIcon; label: Bi }[] = [
  { id: "now", icon: Clock, label: { en: "Now", es: "Ahora" } },
  { id: "live", icon: Radio, label: { en: "Live", es: "Directo" } },
  { id: "polls", icon: BarChart3, label: { en: "Polls", es: "Sondeos" } },
  { id: "blocs", icon: Columns3, label: { en: "Blocs", es: "Bloques" } },
  { id: "count", icon: Landmark, label: { en: "Count", es: "Recuento" } },
  { id: "vote", icon: Vote, label: { en: "Vote", es: "Voto" } },
  { id: "sources", icon: BookOpen, label: { en: "Sources", es: "Fuentes" } },
];

const PHASE_LABEL: Record<Phase, Bi> = {
  campaign: { en: "Campaign still on", es: "Campaña en curso" },
  reflection: { en: "Reflection day", es: "Jornada de reflexión" },
  preelection: { en: "Election day, not yet open", es: "Jornada electoral, sin abrir" },
  open: { en: "Polls are open", es: "Colegios abiertos" },
  canaries: { en: "Mainland closed · Canaries voting", es: "Península cerrada · Canarias vota" },
  count: { en: "Polls closed", es: "Colegios cerrados" },
};

const KIND_LABEL: Record<Kind, Bi> = {
  "official-poll": { en: "Official · poll", es: "Oficial · sondeo" },
  media: { en: "Media poll", es: "Sondeo de medio" },
  model: { en: "Informal model", es: "Modelo informal" },
};

const KIND_ORDER: Kind[] = ["official-poll", "media", "model"];

const FILTERS: { id: Filter; label: Bi }[] = [
  { id: "all", label: { en: "All", es: "Todos" } },
  { id: "official-poll", label: { en: "Official", es: "Oficial" } },
  { id: "media", label: { en: "Media", es: "Medios" } },
  { id: "model", label: { en: "Models", es: "Modelos" } },
];

const HEADLINE_PARTIES: PartyId[] = ["pp", "psoe", "vox"];

const AGENCY: Bi = { en: "Survey agency", es: "Encuestadora" };

const RULE_ICONS: LucideIcon[] = [Layers, IdCard, Landmark, BadgeCheck];

/* Shared type and layout recipes. Interface colour is ink, paper and gold only. */
const WRAP = "mx-auto w-full max-w-[1200px] px-5 md:px-8";
const LABEL = "font-mono text-[11px] tracking-[0.08em] uppercase";
const H1 =
  "text-[length:clamp(34px,1.2rem_+_3.3vw,56px)] leading-[1.05] font-medium tracking-[-0.035em]";
const H2 = "text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] md:text-[30px]";
const H3 = "text-[22px] leading-[1.2] font-semibold tracking-[-0.025em]";
const BIG = "leading-none tracking-[-0.045em] tabular-nums";
const LINK =
  "inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-gold underline-offset-4";
const TABLE_COLS =
  "grid grid-cols-[minmax(210px,1.6fr)_minmax(130px,1fr)_repeat(3,60px)_repeat(3,84px)_88px_20px] gap-x-4";
const NUM = "text-right font-mono text-[13.5px] tabular-nums";
const LEDGER_COLS = "grid grid-cols-[minmax(0,1fr)_44px_92px_52px] gap-x-3";

function t(copy: Bi, lang: Lang): string {
  return copy[lang];
}

function rowCounts(total: number, rows: number): number[] {
  const weights = Array.from({ length: rows }, (_, i) => i + 4);
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.floor((total * w) / sum));
  let used = counts.reduce((a, b) => a + b, 0);
  let i = rows - 1;
  while (used < total) {
    counts[i] += 1;
    used += 1;
    i = i === 0 ? rows - 1 : i - 1;
  }
  return counts;
}

function splitRemaining(ms: number): { d: number; h: number; m: number; s: number } {
  const safe = Math.max(0, ms);
  const s = Math.floor(safe / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

function madridClock(now: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function rightBlocSpan(): { low: number; high: number; n: number } | null {
  let low = Infinity;
  let high = -Infinity;
  let n = 0;
  for (const poll of POLLS) {
    if (poll.kind !== "media") continue;
    const pp = poll.seats.find((s) => s.party === "pp");
    const vox = poll.seats.find((s) => s.party === "vox");
    if (!pp || !vox) continue;
    low = Math.min(low, pp.low + vox.low);
    high = Math.max(high, pp.high + vox.high);
    n += 1;
  }
  return n > 0 ? { low, high, n } : null;
}

/**
 * How a release is named: the media outlet first, then the survey agency that
 * did the fieldwork. The state pollster and the models keep their own name.
 */
function pollNames(
  poll: Poll,
  lang: Lang,
): { title: string; sub: string; agency: string; icon: LucideIcon } {
  if (poll.kind === "media") {
    return poll.outlet === poll.pollster
      ? { title: poll.pollster, sub: t(AGENCY, lang), agency: "", icon: ClipboardList }
      : {
          title: poll.outlet,
          sub: `${t(AGENCY, lang)}: ${poll.pollster}`,
          agency: poll.pollster,
          icon: Newspaper,
        };
  }
  if (poll.kind === "official-poll") {
    return {
      title: poll.pollster,
      sub: `${poll.outlet} · ${t({ en: "State survey agency", es: "Instituto público de encuestas" }, lang)}`,
      agency: "",
      icon: Landmark,
    };
  }
  return {
    title: poll.pollster,
    sub: poll.outlet === poll.pollster ? t({ en: "Model", es: "Modelo" }, lang) : poll.outlet,
    agency: "",
    icon: Calculator,
  };
}

type SpreadRow = {
  id: string;
  title: string;
  agency: string;
  low: number;
  high: number;
  split: boolean;
};

/** One row per media poll: PP low + Vox low to PP high + Vox high, or the printed pair. */
function spreadRows(lang: Lang): SpreadRow[] {
  const split: SpreadRow[] = [];
  const whole: SpreadRow[] = [];
  for (const poll of POLLS) {
    if (poll.kind !== "media") continue;
    const names = pollNames(poll, lang);
    const pp = poll.seats.find((s) => s.party === "pp");
    const vox = poll.seats.find((s) => s.party === "vox");
    if (pp && vox) {
      split.push({
        id: poll.id,
        title: names.title,
        agency: names.agency,
        low: pp.low + vox.low,
        high: pp.high + vox.high,
        split: true,
      });
    } else if (poll.pair !== undefined) {
      whole.push({
        id: poll.id,
        title: names.title,
        agency: names.agency,
        low: poll.pair,
        high: poll.pair,
        split: false,
      });
    }
  }
  return [...split, ...whole];
}

/** PP + Vox for the polls table. Simulation intervals are not added up. */
function pairLabel(poll: Poll): string {
  const pp = poll.seats.find((s) => s.party === "pp");
  const vox = poll.seats.find((s) => s.party === "vox");
  if (pp && vox) {
    const ranged = pp.low !== pp.high || vox.low !== vox.high;
    if (poll.kind === "model" && ranged) return "—";
    return seatLabel(pp.low + vox.low, pp.high + vox.high);
  }
  if (poll.pair !== undefined) return `${poll.pair}*`;
  return "—";
}

function partyShorts(ids: PartyId[]): string {
  return ids.map((id) => PARTIES[id].short).join(" · ");
}

/** A link to a section. "Now" is the home page; the others have their own address. */
function SectionLink({
  to,
  className,
  current,
  children,
}: {
  to: Tab;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to="/{-$section}"
      params={{ section: to === "now" ? undefined : to }}
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}

/** Spain's flag in its plain civil form: three bands, no coat of arms. */
function SpainFlag() {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" className="h-3 w-[18px] shrink-0 rounded-[1px]">
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </svg>
  );
}

function Badge({
  kind,
  lang,
}: {
  kind: Kind | "official" | "law" | "state" | "press";
  lang: Lang;
}) {
  const label =
    kind === "official"
      ? t({ en: "Official · count", es: "Oficial · recuento" }, lang)
      : kind === "law"
        ? t({ en: "Official · law", es: "Oficial · norma" }, lang)
        : kind === "state"
          ? t({ en: "Official", es: "Oficial" }, lang)
          : kind === "press"
            ? t({ en: "Media", es: "Medios" }, lang)
            : t(KIND_LABEL[kind], lang);
  const tone =
    kind === "media" || kind === "press"
      ? "text-ink"
      : kind === "model"
        ? "text-muted"
        : "text-gold-ink";
  const Icon =
    kind === "media" || kind === "press"
      ? Newspaper
      : kind === "model"
        ? Calculator
        : kind === "law"
          ? Scale
          : BadgeCheck;
  return (
    <span className={`inline-flex items-center gap-2 ${LABEL} ${tone}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}

function Heading({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className={`flex items-center gap-2.5 ${H2}`}>
      <Icon className="size-6 shrink-0 text-gold-ink" strokeWidth={1.75} aria-hidden="true" />
      {children}
    </h2>
  );
}

function WingName({ id, lang }: { id: WingId; lang: Lang }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0"
        style={{ background: WINGS[id].color }}
      />
      {t(WINGS[id].label, lang)}
    </span>
  );
}

function ShareBars({ shares, lang }: { shares: Poll["shares"]; lang: Lang }) {
  if (shares.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {shares.map((share) => (
        <li
          key={share.party}
          className="grid grid-cols-[4rem_minmax(0,1fr)_3.25rem] items-center gap-3"
        >
          <span className="text-[13px] font-semibold">{PARTIES[share.party].short}</span>
          <span className="h-2 bg-line" aria-hidden="true">
            <span
              className="block h-full"
              style={{
                width: `${Math.min(100, (share.pct / 40) * 100)}%`,
                background: PARTIES[share.party].color,
              }}
            />
          </span>
          <span className="text-right font-mono text-[12.5px] tabular-nums">
            {formatPct(share.pct, lang)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function SeatChips({ seats, lang }: { seats: Poll["seats"]; lang: Lang }) {
  if (seats.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {seats.map((seat) => (
        <li
          key={seat.party}
          className="flex items-center gap-2 border border-line px-2 py-1 text-[13px]"
        >
          <span className="size-2 rounded-full" style={{ background: PARTIES[seat.party].color }} />
          <span className="font-semibold">{PARTIES[seat.party].short}</span>
          <span className="font-mono tabular-nums">{seatLabel(seat.low, seat.high)}</span>
          <span className="text-muted">{t({ en: "seats", es: "esc." }, lang)}</span>
        </li>
      ))}
    </ul>
  );
}

function SourceLink({ poll }: { poll: Poll }) {
  const source = sourceById(poll.sourceId);
  return (
    <a className={`${LINK} text-sm`} href={source.href} target="_blank" rel="noreferrer">
      {source.name}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

/** Phone, tablet and small laptop: one poll per block, everything visible. */
function PollCard({ poll, lang }: { poll: Poll; lang: Lang }) {
  const names = pollNames(poll, lang);
  const Icon = names.icon;
  return (
    <article className="flex flex-col gap-3 border-t border-ink pt-5 pb-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge kind={poll.kind} lang={lang} />
        <span className="text-[13px] text-muted">{t(poll.when, lang)}</span>
      </div>
      <div>
        <h3 className={`flex items-center gap-2 ${H3}`}>
          <Icon className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
          {names.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted">
          {names.sub}
          {poll.sample ? ` · ${t(poll.sample, lang)}` : ""}
        </p>
      </div>
      <ShareBars shares={poll.shares} lang={lang} />
      <SeatChips seats={poll.seats} lang={lang} />
      <p className="text-sm leading-relaxed">{t(poll.extra, lang)}</p>
      <SourceLink poll={poll} />
    </article>
  );
}

function PartyHead({ id }: { id: PartyId }) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span
        aria-hidden="true"
        className="size-2 rounded-full"
        style={{ background: PARTIES[id].color }}
      />
      {PARTIES[id].short}
    </span>
  );
}

function Cell({ value }: { value: string }) {
  return <span className={`${NUM} ${value === "—" ? "text-muted" : ""}`}>{value}</span>;
}

/** Wide screens: every release on one comparable grid, each with its graph and note. */
function PollTable({
  polls,
  lang,
  open,
  onToggle,
}: {
  polls: Poll[];
  lang: Lang;
  open: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className={`${TABLE_COLS} items-end pb-2 ${LABEL} text-muted`}>
        <span className="col-span-2" />
        <span className="col-span-3 border-b border-ink pb-1.5 text-right">
          {t({ en: "Vote share, %", es: "Voto, %" }, lang)}
        </span>
        <span className="col-span-3 border-b border-ink pb-1.5 text-right">
          {t({ en: "Seats", es: "Escaños" }, lang)}
        </span>
        <span className="border-b border-ink pb-1.5 text-right">PP + Vox</span>
        <span />
      </div>
      <div className={`${TABLE_COLS} items-center pb-3 text-[13px] font-semibold`}>
        <span>{t({ en: "Outlet and survey agency", es: "Medio y encuestadora" }, lang)}</span>
        <span>{t({ en: "Fieldwork and sample", es: "Trabajo de campo y muestra" }, lang)}</span>
        {HEADLINE_PARTIES.map((id) => (
          <PartyHead key={`share-${id}`} id={id} />
        ))}
        {HEADLINE_PARTIES.map((id) => (
          <PartyHead key={`seat-${id}`} id={id} />
        ))}
        <span className="text-right">{t({ en: "seats", es: "escaños" }, lang)}</span>
        <span />
      </div>
      {KIND_ORDER.map((kind) => {
        const group = polls.filter((poll) => poll.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind} className="mt-2 border-t border-ink first:mt-0">
            <div className="pt-5 pb-2.5">
              <Badge kind={kind} lang={lang} />
            </div>
            {group.map((poll) => {
              const on = open.includes(poll.id);
              const names = pollNames(poll, lang);
              const Icon = names.icon;
              return (
                <div key={poll.id} className="border-t border-line">
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => onToggle(poll.id)}
                    className={`${TABLE_COLS} w-full items-baseline py-3.5 text-left`}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-[15.5px] font-semibold">
                        <Icon
                          className="size-4 shrink-0 text-muted"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        {names.title}
                      </span>
                      <span className="pl-6 text-[13px] text-muted">{names.sub}</span>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5 text-[13px] leading-snug">
                      <span>{t(poll.when, lang)}</span>
                      <span className="text-muted">{poll.sample ? t(poll.sample, lang) : ""}</span>
                    </span>
                    {HEADLINE_PARTIES.map((id) => {
                      const share = poll.shares.find((s) => s.party === id);
                      return (
                        <Cell
                          key={`share-${id}`}
                          value={share ? formatPct(share.pct, lang) : "—"}
                        />
                      );
                    })}
                    {HEADLINE_PARTIES.map((id) => {
                      const seat = poll.seats.find((s) => s.party === id);
                      return (
                        <Cell
                          key={`seat-${id}`}
                          value={seat ? seatLabel(seat.low, seat.high) : "—"}
                        />
                      );
                    })}
                    <span className={`${NUM} font-semibold`}>{pairLabel(poll)}</span>
                    <ChevronDown
                      className={`size-4 self-center text-muted transition-transform ${on ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  {on && (
                    <div className="mb-4 flex flex-wrap gap-x-14 gap-y-5 bg-raised px-6 pt-5 pb-5">
                      {(poll.shares.length > 0 || poll.seats.length > 0) && (
                        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
                          <ShareBars shares={poll.shares} lang={lang} />
                          <SeatChips seats={poll.seats} lang={lang} />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-[2_1_380px] flex-col items-start gap-1.5">
                        <p className="max-w-[72ch] text-[14.5px] leading-[1.6]">
                          {t(poll.extra, lang)}
                        </p>
                        <SourceLink poll={poll} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Hemicycle({ active, lang }: { active: PartyId | null; lang: Lang }) {
  const dots = useMemo(() => {
    const sequence: PartyId[] = [];
    for (const id of READ_2023) {
      const block = RESULT_2023.find((b) => b.party === id);
      if (!block) continue;
      for (let i = 0; i < block.seats; i += 1) sequence.push(id);
    }
    const rows = rowCounts(sequence.length, 9);
    const seats: { x: number; y: number; angle: number }[] = [];
    const cx = 180;
    const cy = 178;
    rows.forEach((count, r) => {
      const radius = 38 + r * 15;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.PI * (1 - (i + 0.5) / count);
        seats.push({
          x: Math.round((cx + Math.cos(angle) * radius) * 100) / 100,
          y: Math.round((cy - Math.sin(angle) * radius) * 100) / 100,
          angle,
        });
      }
    });
    // Fill by angle, not ring by ring, so each party is a wedge read left to right.
    seats.sort((a, b) => b.angle - a.angle || b.y - a.y);
    return seats.map((seat, i) => ({ x: seat.x, y: seat.y, party: sequence[i] ?? "other", i }));
  }, []);

  return (
    <>
      <svg viewBox="0 0 360 196" role="img" className="w-full max-w-[760px]">
        <title>
          {t(
            {
              en: "2023 Congress seats, official result, arranged left to right for reading",
              es: "Escaños del Congreso en 2023, resultado oficial, de izquierda a derecha para leerse",
            },
            lang,
          )}
        </title>
        {dots.map((dot) => {
          const dim = active !== null && active !== dot.party;
          return (
            <circle
              key={dot.i}
              cx={dot.x}
              cy={dot.y}
              r={2.9}
              fill={PARTIES[dot.party].color}
              opacity={dim ? 0.18 : 1}
            />
          );
        })}
      </svg>
      <p className="sr-only">
        {RESULT_2023.map((b) => `${PARTIES[b.party].short} ${b.seats}`).join(", ")}
      </p>
    </>
  );
}

function WingBar({ parts }: { parts: { key: string; pct: number; color: string }[] }) {
  return (
    <div className="flex h-3 overflow-hidden bg-line" aria-hidden="true">
      {parts.map((part) =>
        part.pct > 0 ? (
          <span
            key={part.key}
            className="h-full"
            style={{ width: `${part.pct}%`, background: part.color }}
          />
        ) : null,
      )}
    </div>
  );
}

function BlocsView({ lang }: { lang: Lang }) {
  const official = resultByWing();
  const model = POLLS.find((poll) => poll.id === "votantonio");
  const modelSlices = model ? slicesOf(model) : null;
  const seatParts = official.map((wing) => ({
    key: wing.id,
    pct: (wing.seats / CONGRESS) * 100,
    color: WINGS[wing.id].color,
  }));

  return (
    <>
      <section className={`${WRAP} pt-8 pb-10 md:pt-14`}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Badge kind="official" lang={lang} />
          <Badge kind="model" lang={lang} />
        </div>
        <h1 className={`mt-4 ${H1}`}>
          {t({ en: "Left, center, right", es: "Izquierda, centro, derecha" }, lang)}
        </h1>
        <p className="mt-4 max-w-[75ch] text-base leading-[1.6] text-muted">
          {t(
            {
              en: "A reading aid, not an official label. Interior does not publish results in three wings. The 2023 seats below are the ministry’s count, regrouped. The poll rows only add parties that release actually printed. A dash means “not in this release”, not zero.",
              es: "Una ayuda para leer, no una etiqueta oficial. Interior no publica los resultados en tres bloques. Los escaños de 2023 son el recuento del ministerio, reagrupado. Las filas de sondeos solo suman los partidos que esa entrega publicó. Una raya significa «no está en esta entrega», no cero.",
            },
            lang,
          )}
        </p>
      </section>

      <section className="border-y border-ink">
        <div className={`${WRAP} grid md:grid-cols-3`}>
          {official.map((wing) => (
            <article
              key={wing.id}
              className="border-t border-line py-7 first:border-t-0 md:border-t-0 md:border-l md:pr-6 md:pl-5"
            >
              <p className={`text-[length:clamp(48px,1.5rem_+_3.4vw,72px)] ${BIG}`}>{wing.seats}</p>
              <h2 className={`mt-3 ${LABEL}`}>
                <WingName id={wing.id} lang={lang} />
              </h2>
              <p className="mt-1 text-sm text-muted">
                {t({ en: "seats in 2023", es: "escaños en 2023" }, lang)}
                {" · "}
                {formatPct(wing.pct, lang)}%
              </p>
              <p className="mt-3 text-sm font-semibold">{partyShorts(wing.parties)}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t(WINGS[wing.id].blurb, lang)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className={`${WRAP} flex flex-wrap items-start gap-x-16 gap-y-12 pt-10 pb-12 md:pt-16`}
      >
        <div className="min-w-0 flex-[1_1_440px]">
          <Heading icon={Landmark}>
            {t({ en: "2023 Congress, by wing", es: "Congreso de 2023, por bloque" }, lang)}
          </Heading>
          <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-muted">
            {t(
              {
                en: "166 left, 13 center, 171 right. That is all 350 seats. The vote shares are of valid ballots. About 3.3 points went to lists that won no seat, plus blank ballots, so the three wings do not add up to 100.",
                es: "166 la izquierda, 13 el centro, 171 la derecha. Son los 350 escaños. Los porcentajes son sobre votos válidos. Unos 3,3 puntos fueron a listas sin escaño, más el voto en blanco, así que los tres bloques no suman 100.",
              },
              lang,
            )}
          </p>
          <div className="mt-6">
            <WingBar parts={seatParts} />
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {official.map((wing) => (
              <li key={wing.id}>
                <span className="font-semibold">
                  <WingName id={wing.id} lang={lang} />
                </span>
                <span className="mt-0.5 block font-mono text-[13px] tabular-nums">
                  {wing.seats} · {formatPct(wing.pct, lang)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        {model && modelSlices && (
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-3">
            <Badge kind="model" lang={lang} />
            <Heading icon={Calculator}>
              {t({ en: "Against one full model", es: "Frente a un modelo completo" }, lang)}
            </Heading>
            <p className="max-w-[70ch] text-[15px] leading-[1.6]">
              {t(
                {
                  en: "VotAntonio, 23 November, is the only frozen source here that prints both a national share and a seat for almost every list. It is an informal average of 109 polls, not a count. Its seat rows add up to 349.",
                  es: "VotAntonio, 23 de noviembre, es la única fuente congelada aquí que da porcentaje nacional y escaños de casi todas las listas. Es una media informal de 109 sondeos, no un recuento. Sus filas de escaños suman 349.",
                },
                lang,
              )}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead>
                  <tr className={`border-b border-ink ${LABEL} text-muted`}>
                    <th className="py-2 pr-3 font-normal">
                      {t({ en: "Wing", es: "Bloque" }, lang)}
                    </th>
                    <th className="py-2 pr-3 text-right font-normal">
                      {t({ en: "2023 seats", es: "Escaños 2023" }, lang)}
                    </th>
                    <th className="py-2 pr-3 text-right font-normal">
                      {t({ en: "Model seats", es: "Escaños modelo" }, lang)}
                    </th>
                    <th className="py-2 text-right font-normal">
                      {t({ en: "Model vote", es: "Voto modelo" }, lang)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {official.map((wing) => {
                    const slice = modelSlices[wing.id];
                    const delta =
                      slice.low !== null && slice.high !== null && slice.low === slice.high
                        ? slice.low - wing.seats
                        : null;
                    return (
                      <tr key={wing.id} className="border-b border-line">
                        <th className="py-3 pr-3 font-semibold">
                          <WingName id={wing.id} lang={lang} />
                        </th>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          {wing.seats}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          {slice.low === null ? "—" : seatLabel(slice.low, slice.high ?? slice.low)}
                          {delta !== null && (
                            <span className="ml-2 text-muted">
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {slice.pct === null ? "—" : `${formatPct(slice.pct, lang)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              {t(
                {
                  en: "In that model the right is PP 131, Vox 62 and SALF on the vote share only (2.0%, no seat row). The left is PSOE 114, Frente Amplio 9, ERC 10, EH Bildu 7, Front Valencià 4, BNG 2 and Podemos on the vote share only. Center is Junts 5, PNV 4, Coalición Canaria 1.",
                  es: "En ese modelo la derecha es PP 131, Vox 62 y SALF solo en voto (2,0%, sin fila de escaños). La izquierda es PSOE 114, Frente Amplio 9, ERC 10, EH Bildu 7, Front Valencià 4, BNG 2 y Podemos solo en voto. El centro es Junts 5, PNV 4, Coalición Canaria 1.",
                },
                lang,
              )}
            </p>
          </div>
        )}
      </section>

      <section className={`${WRAP} pb-16`}>
        <div className="border-t border-ink pt-8">
          <Heading icon={BarChart3}>
            {t({ en: "Every frozen release", es: "Cada entrega congelada" }, lang)}
          </Heading>
          <p className="mt-3 max-w-[75ch] text-[15px] leading-[1.6] text-muted">
            {t(
              {
                en: "Most newspapers only printed PP, PSOE and Vox. Their “left” cell is then PSOE alone, and their “right” cell is PP+Vox. That is not the whole wing. CIS printed no seats. Congress is not a national proportional system, so a vote share is not a seat.",
                es: "La mayoría de los periódicos solo publicó PP, PSOE y Vox. Su celda de izquierda es entonces solo el PSOE, y la de derecha es PP+Vox. Eso no es el bloque entero. El CIS no publicó escaños. El Congreso no es proporcional nacional, así que un porcentaje no es un escaño.",
              },
              lang,
            )}
          </p>
        </div>
        <div className="mt-6 border-b border-line">
          {POLLS.map((poll) => (
            <PollWingRow key={poll.id} poll={poll} lang={lang} />
          ))}
        </div>
        <SectionLink to="polls" className={`${LINK} mt-4 text-[15px]`}>
          {t({ en: "Open the poll cards", es: "Abrir las fichas de sondeos" }, lang)}
          <ArrowRight className="size-4" aria-hidden="true" />
        </SectionLink>
      </section>
    </>
  );
}

function PollWingRow({ poll, lang }: { poll: Poll; lang: Lang }) {
  const slices = slicesOf(poll);
  const other = otherShare(poll);
  const names = pollNames(poll, lang);
  const shareParts: { key: string; pct: number; color: string }[] = WING_ORDER.map((id) => ({
    key: id,
    pct: slices[id].pct ?? 0,
    color: WINGS[id].color,
  }));
  if (other > 0) shareParts.push({ key: "other", pct: other, color: "var(--color-other)" });
  const printed = shareParts.reduce((sum, part) => sum + part.pct, 0);
  const hasShares = printed > 0;

  return (
    <article className="grid gap-x-12 gap-y-4 border-t border-line py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex flex-col items-start gap-1.5">
        <Badge kind={poll.kind} lang={lang} />
        <h3 className="text-[15.5px] font-semibold">{names.title}</h3>
        <p className="text-[13px] text-muted">{names.sub}</p>
        <p className="text-[13px] text-muted">{t(poll.when, lang)}</p>
      </div>
      <div>
        <dl className="grid grid-cols-3 gap-3">
          {WING_ORDER.map((id) => {
            const slice = slices[id];
            return (
              <div key={id}>
                <dt className={LABEL}>
                  <WingName id={id} lang={lang} />
                </dt>
                <dd className="mt-2 text-2xl leading-none font-medium tracking-[-0.03em] tabular-nums">
                  {slice.pct === null ? "—" : `${formatPct(slice.pct, lang)}%`}
                </dd>
                <p className="mt-1.5 font-mono text-xs tabular-nums text-muted">
                  {slice.low === null
                    ? t({ en: "no seats printed", es: "sin escaños" }, lang)
                    : `${seatLabel(slice.low, slice.high ?? slice.low)} ${t({ en: "seats", es: "esc." }, lang)}`}
                </p>
                <p className="mt-1 text-xs leading-snug">
                  {slice.parties.length ? partyShorts(slice.parties) : "—"}
                </p>
              </div>
            );
          })}
        </dl>
        {hasShares && (
          <div className="mt-4">
            <WingBar parts={shareParts} />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {t(
                {
                  en: `${formatPct(printed, lang)}% of the vote was printed in this release${other > 0 ? `, including ${formatPct(other, lang)} points of “others” outside the three wings` : ""}. The rest of the bar was not published.`,
                  es: `Esta entrega publicó el ${formatPct(printed, lang)}% del voto${other > 0 ? `, incluidos ${formatPct(other, lang)} puntos de «otros» fuera de los tres bloques` : ""}. El resto de la barra no se publicó.`,
                },
                lang,
              )}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function SpreadChart({ lang }: { lang: Lang }) {
  const rows = spreadRows(lang);
  if (rows.length === 0) return null;
  const lows = rows.map((row) => row.low);
  const highs = rows.map((row) => row.high);
  const start = Math.floor((Math.min(MAJORITY, ...lows) - 10) / 10) * 10;
  const end = Math.ceil(Math.max(MAJORITY, ...highs) / 10) * 10;
  const at = (seats: number) => ((seats - start) / (end - start)) * 100;
  const ticks: number[] = [];
  for (let tick = start + 10; tick < end; tick += 10) {
    if (tick - MAJORITY >= 10) ticks.push(tick);
  }
  const grid =
    "grid grid-cols-[104px_minmax(0,1fr)_58px] gap-3 sm:grid-cols-[132px_minmax(0,1fr)_64px] sm:gap-4";

  return (
    <figure className="mt-2 border-t border-ink pt-3">
      <div className={`${grid} h-6 items-end font-mono text-[10.5px] text-muted`}>
        <span className="tracking-[0.08em] uppercase">
          {t({ en: "Seats", es: "Escaños" }, lang)}
        </span>
        <span className="relative block h-4" aria-hidden="true">
          <span className="absolute left-0">{start}</span>
          <span
            className="absolute -translate-x-1/2 font-semibold text-gold-ink"
            style={{ left: `${at(MAJORITY)}%` }}
          >
            {MAJORITY}
          </span>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute hidden -translate-x-1/2 sm:block"
              style={{ left: `${at(tick)}%` }}
            >
              {tick}
            </span>
          ))}
          <span className="absolute right-0">{end}</span>
        </span>
        <span />
      </div>
      <ul>
        {rows.map((row) => {
          const point = row.low === row.high;
          return (
            <li key={row.id} className={`${grid} h-12 items-center border-t border-line`}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13.5px] leading-tight font-semibold">
                  {row.title}
                </span>
                {row.agency && (
                  <span className="truncate text-[11.5px] leading-tight text-muted">
                    {row.agency}
                  </span>
                )}
              </span>
              <span className="relative block h-full" aria-hidden="true">
                <span
                  className="absolute inset-y-0 w-px bg-gold"
                  style={{ left: `${at(MAJORITY)}%` }}
                />
                <span
                  className={`absolute top-1/2 h-2.5 min-w-2.5 -translate-y-1/2 rounded-full border-2 border-ink ${
                    row.split ? "bg-ink" : "bg-transparent"
                  }`}
                  style={{
                    left: `${at(row.low)}%`,
                    width: `${at(row.high) - at(row.low)}%`,
                    marginLeft: point ? -5 : 0,
                  }}
                />
              </span>
              <span className="text-right font-mono text-xs tabular-nums">
                {seatLabel(row.low, row.high)}
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="border-t border-line pt-3 text-[13px] leading-normal text-muted">
        {t(
          {
            en: `Each row is a media outlet, with its survey agency underneath. A bar runs from a poll’s PP low plus Vox low to its PP high plus Vox high. A dot is a single printed figure. A hollow dot is a release that printed the pair without a split. The scale runs from ${start} to ${end} seats. The gold line is ${MAJORITY}.`,
            es: `Cada fila es un medio, con su encuestadora debajo. Cada barra va del suelo del PP más el suelo de Vox al techo del PP más el techo de Vox en ese sondeo. Un punto es una cifra única publicada. Un punto hueco es una entrega que publicó la suma sin reparto. La escala va de ${start} a ${end} escaños. La línea dorada es ${MAJORITY}.`,
          },
          lang,
        )}
      </figcaption>
    </figure>
  );
}

/* Live page: every time is shown in Madrid time, whatever the reader's own clock says. */
const MADRID = "Europe/Madrid";
const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: MADRID,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DAY_LABEL: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", {
    timeZone: MADRID,
    weekday: "short",
    day: "numeric",
    month: "short",
  }),
  es: new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID,
    weekday: "short",
    day: "numeric",
    month: "short",
  }),
};

const LIVE_FIRST_PAGE = 30;

function ago(at: number, now: number, lang: Lang): string | null {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 0 || minutes >= 60) return null;
  if (minutes < 1) return t({ en: "just now", es: "ahora mismo" }, lang);
  return t({ en: `${minutes} min ago`, es: `hace ${minutes} min` }, lang);
}

type DayGroup = { key: string; label: string; items: LiveItem[] };

function groupByDay(items: LiveItem[], now: number, lang: Lang): DayGroup[] {
  const today = DAY_KEY.format(now);
  const yesterday = DAY_KEY.format(now - 86_400_000);
  const groups: DayGroup[] = [];
  for (const item of items) {
    const key = DAY_KEY.format(item.at);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const date = DAY_LABEL[lang].format(item.at);
      const label =
        key === today
          ? `${t({ en: "Today", es: "Hoy" }, lang)} · ${date}`
          : key === yesterday
            ? `${t({ en: "Yesterday", es: "Ayer" }, lang)} · ${date}`
            : date;
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** The headline to show: the machine translation in the English version when there is one, else the original. */
function headline(item: LiveItem, lang: Lang): string {
  return lang === "en" && item.titleEn ? item.titleEn : item.title;
}

/** One line on the first page: the newest headline, linking to the Live page. */
function LatestStrip({ feed, lang }: { feed: LiveFeed; lang: Lang }) {
  // The newest headline that is plainly about the vote, not just one that names a candidate.
  const item = feed.data?.items.find((entry) => entry.core);
  return (
    <div className="border-b border-line">
      <SectionLink to="live" className={`${WRAP} flex h-[60px] items-center gap-3 text-sm sm:h-11`}>
        <span className={`inline-flex shrink-0 items-center gap-2 ${LABEL} text-gold-ink`}>
          <Radio className="size-4 shrink-0 sm:size-3.5" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">
            {t({ en: "Latest", es: "Última hora" }, lang)}
          </span>
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 leading-snug font-medium sm:line-clamp-1">
          {item
            ? headline(item, lang)
            : t(
                {
                  en: "Election headlines from Spanish media",
                  es: "Titulares electorales de medios españoles",
                },
                lang,
              )}
        </span>
        {item && (
          <span className="hidden shrink-0 font-mono text-xs text-muted tabular-nums sm:inline">
            {item.outlet} · {CLOCK.format(item.at)}
          </span>
        )}
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </SectionLink>
    </div>
  );
}

function LiveView({
  feed,
  lang,
  now,
  kicker,
}: {
  feed: LiveFeed;
  lang: Lang;
  now: number;
  kicker: ReactNode;
}) {
  const [limit, setLimit] = useState(LIVE_FIRST_PAGE);
  const items = feed.data?.items;
  const sources = feed.data?.sources ?? [];
  const groups = groupByDay((items ?? []).slice(0, limit), now, lang);
  const total = items?.length ?? 0;
  const anyAnswered = sources.some((source) => source.ok);

  return (
    <>
      <section
        className={`${WRAP} flex flex-wrap items-start gap-x-16 gap-y-10 pt-8 pb-12 md:pt-14`}
      >
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {kicker}
          <h1 className={H1}>
            {t({ en: "Latest election headlines", es: "Últimos titulares electorales" }, lang)}
          </h1>
          <p className="max-w-[64ch] text-base leading-[1.6] text-muted">
            {t(
              {
                en: "Election headlines from Spanish media, newest first. Each one links to the outlet’s own article. They are picked automatically by keyword. The desk does not write or check them. The English is a machine translation, with the original headline underneath. Times are Madrid time.",
                es: "Titulares electorales de medios españoles, del más reciente al más antiguo. Cada uno enlaza al artículo del propio medio. Se seleccionan automáticamente por palabras clave. La mesa no los redacta ni los comprueba. Las horas son de Madrid.",
              },
              lang,
            )}
          </p>
        </div>

        <aside className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 border-t-[3px] border-ink bg-raised px-6 pt-6 pb-6">
          <Badge kind="state" lang={lang} />
          <h2 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.025em]">
            {t({ en: "Official sources", es: "Fuentes oficiales" }, lang)}
          </h2>
          <ul className="flex flex-col">
            {LIVE_PINNED.map((pin) => (
              <li
                key={pin.id}
                className="flex flex-col items-start gap-1 border-t border-line pt-3.5 pb-2 first:border-t-0 first:pt-0"
              >
                <h3 className="text-[15.5px] font-semibold">{t(pin.title, lang)}</h3>
                <p className="text-[14.5px] leading-[1.6]">{t(pin.text, lang)}</p>
                <a
                  className={`${LINK} text-sm`}
                  href={pin.link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t(pin.link.label, lang)}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="border-t border-ink">
        <div className={`${WRAP} pt-10 pb-16`}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div className="flex flex-col items-start gap-3">
              <Badge kind="press" lang={lang} />
              <Heading icon={Radio}>
                {t({ en: "Media headlines", es: "Titulares de medios" }, lang)}
              </Heading>
            </div>
            {feed.data && (
              <p className={`${LABEL} text-muted`}>
                {t(
                  {
                    en: `Updated ${CLOCK.format(feed.data.fetchedAt)} · checked again every two minutes`,
                    es: `Actualizado a las ${CLOCK.format(feed.data.fetchedAt)} · se comprueba cada dos minutos`,
                  },
                  lang,
                )}
              </p>
            )}
          </div>

          {feed.status === "loading" && (
            <p className="mt-6 border-t border-ink pt-5 text-[15px] text-muted" role="status">
              {t({ en: "Loading headlines…", es: "Cargando titulares…" }, lang)}
            </p>
          )}

          {feed.status !== "loading" && total === 0 && (
            <p
              className="mt-6 max-w-[64ch] border-t border-ink pt-5 text-[15px] leading-[1.6]"
              role="status"
            >
              {anyAnswered
                ? t(
                    {
                      en: "No election headlines in the outlets’ feeds right now. The desk checks again every two minutes.",
                      es: "Ahora mismo no hay titulares electorales en los canales de los medios. La mesa vuelve a comprobarlo cada dos minutos.",
                    },
                    lang,
                  )
                : t(
                    {
                      en: "The outlets’ feeds could not be reached right now. The desk checks again every two minutes.",
                      es: "Ahora mismo no se ha podido acceder a los canales de los medios. La mesa vuelve a comprobarlo cada dos minutos.",
                    },
                    lang,
                  )}
            </p>
          )}

          {groups.map((group) => (
            <div key={group.key}>
              <h3 className={`mt-8 border-b border-ink pb-2.5 ${LABEL}`}>{group.label}</h3>
              <ol>
                {group.items.map((item) => {
                  const recent = ago(item.at, now, lang);
                  const shown = headline(item, lang);
                  const translated = shown !== item.title;
                  return (
                    <li
                      key={item.id}
                      className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-4 border-b border-line py-4 sm:grid-cols-[84px_minmax(0,1fr)]"
                    >
                      <span className="pt-[3px] font-mono text-[13px] tabular-nums">
                        {CLOCK.format(item.at)}
                      </span>
                      <div className="flex min-w-0 flex-col items-start gap-1.5">
                        <a
                          className="max-w-[68ch] text-[17px] leading-[1.35] font-semibold tracking-[-0.01em] underline-offset-4 hover:underline"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          lang={translated ? undefined : "es"}
                        >
                          {shown}
                        </a>
                        {translated && (
                          <span
                            lang="es"
                            className="max-w-[68ch] text-[13.5px] leading-snug text-muted"
                          >
                            {item.title}
                          </span>
                        )}
                        <span
                          className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${LABEL} text-muted`}
                        >
                          <Newspaper
                            className="size-3.5 shrink-0"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          {item.outlet}
                          {recent && <span className="text-gold-ink">· {recent}</span>}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}

          {total > limit && (
            <button
              type="button"
              onClick={() => setLimit(total)}
              className={`${LINK} mt-5 text-[15px]`}
            >
              {t({ en: "Show more headlines", es: "Ver más titulares" }, lang)}
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
          )}

          {sources.length > 0 && (
            <p className="mt-8 max-w-[80ch] text-[13px] leading-[1.6] text-muted">
              {t({ en: "Outlets followed", es: "Medios seguidos" }, lang)}
              {": "}
              {sources
                .map((source) =>
                  source.ok
                    ? source.name
                    : `${source.name} (${t({ en: "not responding", es: "sin respuesta" }, lang)})`,
                )
                .join(" · ")}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function Nav({ tab, lang, variant }: { tab: Tab; lang: Lang; variant: "top" | "dock" }) {
  const shell =
    variant === "top"
      ? "hidden flex-wrap gap-1 lg:flex"
      : "dock fixed inset-x-0 bottom-0 z-30 flex border-t border-ink bg-paper lg:hidden";
  return (
    <nav className={shell} aria-label={t({ en: "Sections", es: "Secciones" }, lang)}>
      {TABS.map((item) => {
        const on = tab === item.id;
        const Icon = item.icon;
        const tone =
          variant === "top"
            ? `flex h-11 items-center gap-2 border-b-2 px-2 text-sm xl:px-3 ${
                on
                  ? "border-gold font-semibold text-ink"
                  : "border-transparent font-medium text-muted"
              }`
            : `flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 text-[10.5px] tracking-[-0.01em] ${
                on
                  ? "border-gold font-bold text-ink"
                  : "border-transparent font-semibold text-muted"
              }`;
        return (
          <SectionLink key={item.id} to={item.id} current={on} className={tone}>
            <Icon
              className={variant === "top" ? "size-4" : "size-[18px]"}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {t(item.label, lang)}
          </SectionLink>
        );
      })}
    </nav>
  );
}

export function Mesa({ tab, renderedAt }: { tab: Tab; renderedAt: number }) {
  const [lang, setLang] = useState<Lang>("en");
  const [edition, setEdition] = useState<Edition>("day");
  const [ready, setReady] = useState(false);
  // Starts from the server's render time so the first client render matches the
  // HTML exactly, then ticks on the reader's own clock.
  const [now, setNow] = useState<number>(renderedAt);
  const [filter, setFilter] = useState<Filter>("all");
  const [party, setParty] = useState<PartyId | null>(null);
  // Graphs and notes are open for every release until the reader closes them.
  const [openNotes, setOpenNotes] = useState<string[]>(() => POLLS.map((poll) => poll.id));
  // Headlines load on the Live page and, for the one-line strip, on the first page.
  const live = useLiveFeed(tab === "live" || tab === "now");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mesa-lang");
      if (saved === "es" || saved === "en") setLang(saved);
    } catch {
      /* storage can be blocked; English stays */
    }
    const current = document.documentElement.dataset.edition;
    if (current === "night" || current === "day") setEdition(current);
    setReady(true);
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("mesa-lang", lang);
    } catch {
      /* storage can be blocked */
    }
    document.documentElement.lang = lang;
  }, [lang, ready]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.edition = edition;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", edition === "night" ? "#0b1320" : "#f7f6f2");
  }, [edition, ready]);

  // A new section starts at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const flipEdition = () => {
    const next: Edition = edition === "night" ? "day" : "night";
    setEdition(next);
    try {
      localStorage.setItem("mesa-edition", next);
    } catch {
      /* storage can be blocked; the choice lasts for this visit */
    }
  };

  const phase = phaseAt(now);
  const silence = pollSilence(now);
  const target = countdownTarget(phase);
  const remain = target ? splitRemaining(target.at - now) : null;
  const bloc = rightBlocSpan();
  const visible = POLLS.filter((p) => filter === "all" || p.kind === filter);
  const allNotesOpen = visible.every((poll) => openNotes.includes(poll.id));

  const toggleNote = (id: string) =>
    setOpenNotes((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const phaseKicker = (
    <p className={`flex items-center gap-2.5 ${LABEL} text-gold-ink`}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-gold" />
      {t(PHASE_LABEL[phase], lang)}
    </p>
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="bg-bar text-bar-ink">
        <div className={`${WRAP} flex flex-wrap justify-between gap-x-6 gap-y-0.5 py-2 ${LABEL}`}>
          <span className="flex items-center gap-2">
            <SpainFlag />
            {t({ en: "Spain · Congress and Senate", es: "España · Congreso y Senado" }, lang)}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="size-3 shrink-0" aria-hidden="true" />
            <span suppressHydrationWarning>
              {madridClock(new Date(now), lang)}
              {" · "}
              {t({ en: "Madrid time", es: "Hora de Madrid" }, lang)}
            </span>
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-ink bg-paper">
        <div
          className={`${WRAP} flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 xl:gap-x-8`}
        >
          <SectionLink
            to="now"
            className="text-[26px] leading-[44px] font-semibold tracking-[-0.035em]"
          >
            Mesa 29N
          </SectionLink>
          <Nav tab={tab} lang={lang} variant="top" />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={flipEdition}
              aria-label={
                edition === "night"
                  ? t({ en: "Switch to day edition", es: "Cambiar a edición de día" }, lang)
                  : t({ en: "Switch to night edition", es: "Cambiar a edición de noche" }, lang)
              }
              className="flex size-11 items-center justify-center rounded-[2px] border border-line"
            >
              {edition === "night" ? (
                <Sun className="size-[18px]" aria-hidden="true" />
              ) : (
                <Moon className="size-[18px]" aria-hidden="true" />
              )}
            </button>
            <div
              className="flex rounded-[2px] border border-ink"
              role="group"
              aria-label={t({ en: "Language", es: "Idioma" }, lang)}
            >
              {(["en", "es"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`h-[42px] min-w-11 text-[13px] font-semibold ${
                    lang === code ? "bg-ink text-inv" : "text-ink"
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {tab === "now" && (
          <>
            <LatestStrip feed={live} lang={lang} />
            <section
              className={`${WRAP} flex flex-wrap items-start gap-x-16 gap-y-10 pt-8 pb-12 md:pt-14`}
            >
              <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7">
                {phaseKicker}
                <h1 className={H1}>
                  {t(
                    {
                      en: "Election day is Sunday 29 November 2026.",
                      es: "La jornada electoral es el domingo 29 de noviembre de 2026.",
                    },
                    lang,
                  )}
                </h1>
                <div>
                  <p className={`flex items-center gap-2 ${LABEL} text-muted`}>
                    <Timer className="size-3.5 shrink-0" aria-hidden="true" />
                    {target
                      ? t(target.label, lang)
                      : t({ en: "Scrutiny window", es: "Ventana de escrutinio" }, lang)}
                  </p>
                  {remain ? (
                    <div className="mt-3 grid grid-cols-4 border-y border-t-ink border-b-line">
                      {(
                        [
                          [remain.d, { en: "Days", es: "Días" }],
                          [remain.h, { en: "Hours", es: "Horas" }],
                          [remain.m, { en: "Min", es: "Min" }],
                          [remain.s, { en: "Sec", es: "Seg" }],
                        ] as const
                      ).map(([value, label]) => (
                        <div key={label.en} className="border-l border-line py-4 pl-2.5 md:pl-5">
                          <div className={`text-[length:clamp(52px,2rem_+_5vw,104px)] ${BIG}`}>
                            {value}
                          </div>
                          <div className={`mt-2 ${LABEL} text-muted`}>{t(label, lang)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 border-t border-ink pt-4 text-[length:clamp(26px,1rem_+_2vw,40px)] leading-[1.1] font-medium tracking-[-0.03em]">
                      {t(
                        {
                          en: "Provisional count can start. This desk does not invent one.",
                          es: "El escrutinio provisional puede empezar. Esta mesa no se lo inventa.",
                        },
                        lang,
                      )}
                    </p>
                  )}
                </div>
                <p className="max-w-[60ch] text-[17px] leading-[1.55]">
                  {t(
                    {
                      en: "Sunday 29 November. Stations open 09:00–20:00. Majority in Congress: 176 of 350. Directly elected senators: 209.",
                      es: "Domingo 29 de noviembre. Colegios de 09:00 a 20:00. Mayoría en el Congreso: 176 de 350. Senadores de elección directa: 209.",
                    },
                    lang,
                  )}
                </p>
              </div>

              {silence && (
                <aside className="flex min-w-0 flex-[1_1_380px] flex-col gap-3 border-t-[3px] border-ink bg-raised px-6 pt-6 pb-7">
                  <Badge kind="law" lang={lang} />
                  <h2 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.025em]">
                    {t(
                      { en: "Poll silence is in force", es: "La veda de sondeos está en vigor" },
                      lang,
                    )}
                  </h2>
                  <p className="text-[15px] leading-[1.6]">
                    {t(
                      {
                        en: "Spanish law stops outlets in Spain publishing voting-intention polls during the five days before the election. The figures below are frozen on fieldwork that closed by 23 November. They are not votes, and they are not a count.",
                        es: "La ley impide a los medios en España publicar sondeos de intención de voto durante los cinco días previos. Las cifras de abajo están congeladas en el trabajo de campo cerrado el 23 de noviembre. No son votos y no son un recuento.",
                      },
                      lang,
                    )}
                  </p>
                </aside>
              )}
            </section>

            <section className="border-y border-ink">
              <div className={`${WRAP} grid grid-cols-3`}>
                {(
                  [
                    [
                      CONGRESS,
                      Landmark,
                      { en: "Congress", es: "Congreso" },
                      { en: "deputies", es: "diputados" },
                      false,
                    ],
                    [
                      MAJORITY,
                      Scale,
                      { en: "Majority", es: "Mayoría" },
                      { en: "votes to invest, first round", es: "votos para investir, primera" },
                      true,
                    ],
                    [
                      SENATE_DIRECT,
                      Building2,
                      { en: "Senate, direct", es: "Senado, directo" },
                      { en: "on this ballot", es: "en esta papeleta" },
                      false,
                    ],
                  ] as const
                ).map(([value, Icon, label, caption, gold]) => (
                  <div key={label.en} className="border-l border-line py-6 pr-1 pl-2.5 md:pl-5">
                    <p
                      className={`text-[length:clamp(40px,1.5rem_+_3.4vw,72px)] ${BIG} ${gold ? "text-gold-ink" : ""}`}
                    >
                      {value}
                    </p>
                    <p
                      className={`mt-3 flex items-start gap-1.5 ${LABEL} ${gold ? "text-gold-ink" : ""}`}
                    >
                      <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                      {t(label, lang)}
                    </p>
                    <p className="mt-1 text-sm leading-normal text-muted">{t(caption, lang)}</p>
                    {gold && (
                      <span className="mt-3 block h-1.5 max-w-[220px] bg-line" aria-hidden="true">
                        <span
                          className="block h-full bg-gold"
                          style={{ width: `${(MAJORITY / CONGRESS) * 100}%` }}
                        />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`${WRAP} flex flex-wrap items-start gap-x-16 gap-y-14 pt-10 pb-8 md:pt-16`}
            >
              {bloc && (
                <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
                  <Badge kind="media" lang={lang} />
                  <Heading icon={BarChart3}>
                    {t({ en: "PP + Vox seat spread", es: "Horquilla de escaños PP + Vox" }, lang)}
                  </Heading>
                  <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
                    <p
                      className={`text-[length:clamp(60px,2rem_+_3.8vw,84px)] font-medium whitespace-nowrap ${BIG}`}
                    >
                      {bloc.low}–{bloc.high}
                    </p>
                    <p className="min-w-0 flex-[1_1_300px] text-[15px] leading-[1.6]">
                      {t(
                        {
                          en: `Sum of the published lows, and sum of the published highs, across ${bloc.n} media polls that printed both parties. This is not a joint forecast and not an average. Reuters said on 23 November that all surveys but one put the two parties together above 176. IMOP, which did not split them, had the pair on 195.`,
                          es: `Suma de los suelos publicados y suma de los techos publicados, en ${bloc.n} sondeos de medios que daban a los dos partidos. No es un pronóstico conjunto ni una media. Reuters dijo el 23 de noviembre que todas las encuestas menos una ponían a los dos por encima de 176. IMOP, que no los separaba, los situaba en 195.`,
                        },
                        lang,
                      )}
                    </p>
                  </div>
                  <SpreadChart lang={lang} />
                  <SectionLink to="blocs" className={`${LINK} self-start text-[15px]`}>
                    {t(
                      {
                        en: "See left, center and right",
                        es: "Ver izquierda, centro y derecha",
                      },
                      lang,
                    )}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </SectionLink>
                </div>
              )}

              <aside className="min-w-0 flex-[1_1_380px]">
                <Heading icon={CalendarDays}>
                  {t({ en: "Calendar", es: "Calendario" }, lang)}
                </Heading>
                {/* Latest first: what is still ahead sits on top, what has passed below. */}
                <ol reversed className="mt-4 border-b border-line">
                  {[...CALENDAR].reverse().map((item) => {
                    const tone = calendarTone(item.id, now);
                    const text = tone === "past" ? "text-muted" : "";
                    const StatusIcon =
                      tone === "now" ? CircleDot : tone === "past" ? Check : CalendarClock;
                    return (
                      <li
                        key={item.id}
                        className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-line py-3.5"
                      >
                        <span
                          className={`font-mono text-xs leading-normal tracking-[0.02em] uppercase ${text}`}
                        >
                          {t(item.when, lang)}
                        </span>
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase ${
                              tone === "now"
                                ? "text-gold-ink"
                                : tone === "past"
                                  ? "text-muted"
                                  : "text-ink"
                            }`}
                          >
                            <StatusIcon
                              className="size-3.5 shrink-0"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            {tone === "now"
                              ? t({ en: "Now", es: "Ahora" }, lang)
                              : tone === "past"
                                ? t({ en: "Passed", es: "Pasado" }, lang)
                                : t({ en: "Ahead", es: "Por venir" }, lang)}
                          </span>
                          <p className={`text-sm leading-normal ${text}`}>{t(item.what, lang)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </aside>
            </section>

            <section className={`${WRAP} pt-8 pb-16`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ink pt-6">
                <Heading icon={Users}>
                  {t({ en: "Who is standing", es: "Quién se presenta" }, lang)}
                </Heading>
                <span className={`${LABEL} text-muted`}>
                  {t({ en: "29 November", es: "29 de noviembre" }, lang)}
                </span>
              </div>
              <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
                {CANDIDATES.map((c) => {
                  const party = PARTIES[c.party];
                  const base = c.photo.replace(/\.jpg$/, "");
                  return (
                    <li key={c.party}>
                      <picture>
                        <source
                          type="image/webp"
                          srcSet={`${base}-240.webp 240w, ${base}-320.webp 320w, ${base}-480.webp 480w`}
                          sizes="(min-width: 1024px) 270px, 45vw"
                        />
                        <img
                          src={c.photo}
                          alt={c.name}
                          width={480}
                          height={480}
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full bg-raised object-cover"
                        />
                      </picture>
                      <div className="h-1" style={{ background: party.color }} />
                      <div className="flex flex-col gap-2 pt-4">
                        <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-normal">
                          <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: party.color }}
                          />
                          <span className="font-bold">{party.short}</span>
                          <span className="text-muted">{t(party.name, lang)}</span>
                        </p>
                        <h3 className={H3}>{c.name}</h3>
                        <p className="text-sm leading-normal text-muted">{t(c.role, lang)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-5 text-[12.5px] leading-[1.6] text-muted">
                {t(
                  {
                    en: "Portraits, in order: Alberto Núñez Feijóo (European People’s Party, CC BY 2.0), Pedro Sánchez (Pool Moncloa), Santiago Abascal (Vox España, CC0), Ada Colau (Laura Guerrero / Barcelona City Council, CC BY 4.0). Via Wikimedia Commons.",
                    es: "Retratos, en este orden: Alberto Núñez Feijóo (European People’s Party, CC BY 2.0), Pedro Sánchez (Pool Moncloa), Santiago Abascal (Vox España, CC0), Ada Colau (Laura Guerrero / Ayuntamiento de Barcelona, CC BY 4.0). Vía Wikimedia Commons.",
                  },
                  lang,
                )}
              </p>
            </section>
          </>
        )}

        {tab === "live" && <LiveView feed={live} lang={lang} now={now} kicker={phaseKicker} />}

        {tab === "polls" && (
          <>
            <section
              className={`${WRAP} flex flex-wrap items-end justify-between gap-x-16 gap-y-7 pt-8 pb-8 md:pt-14`}
            >
              <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
                <h1 className={H1}>
                  {t(
                    { en: "Last polls before the ban", es: "Últimos sondeos antes de la veda" },
                    lang,
                  )}
                </h1>
                <p className="max-w-[70ch] text-base leading-[1.6]">
                  {t(
                    {
                      en: "Compared with the official 2023 result, the private polls had Vox near 18% (it took 12.4%) and the broad-left list near 6–7% (Sumar took 12.3%, and Podemos is running separately this time). CIS, the state pollster, still had PSOE on 34.4% and PP on 24.9%.",
                      es: "Frente al resultado oficial de 2023, los sondeos privados dejaban a Vox cerca del 18% (sacó el 12,4%) y a la lista de la izquierda amplia cerca del 6–7% (Sumar sacó el 12,3%, y Podemos concurre por separado). El CIS, el instituto público, aún daba al PSOE un 34,4% y al PP un 24,9%.",
                    },
                    lang,
                  )}
                </p>
              </div>
              <div
                className="flex w-full rounded-[2px] border border-ink md:w-auto"
                role="group"
                aria-label={t({ en: "Which polls to show", es: "Qué sondeos mostrar" }, lang)}
              >
                {FILTERS.map((item) => {
                  const on = filter === item.id;
                  const count =
                    item.id === "all"
                      ? POLLS.length
                      : POLLS.filter((p) => p.kind === item.id).length;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFilter(item.id)}
                      className={`flex h-11 flex-1 items-center justify-center gap-1.5 border-l border-line px-2 text-[13px] font-semibold first:border-l-0 sm:gap-2 sm:px-3 sm:text-sm md:flex-none md:px-4 ${
                        on ? "bg-ink text-inv" : "text-ink"
                      }`}
                    >
                      {t(item.label, lang)}
                      <span
                        className={`font-mono text-[11px] tabular-nums ${on ? "" : "text-muted"}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={`${WRAP} hidden xl:block`}>
              <div className="flex justify-end pb-2">
                <button
                  type="button"
                  onClick={() => setOpenNotes(allNotesOpen ? [] : visible.map((poll) => poll.id))}
                  className={`${LINK} text-sm`}
                >
                  {allNotesOpen
                    ? t(
                        {
                          en: "Hide all graphs and notes",
                          es: "Ocultar todos los gráficos y notas",
                        },
                        lang,
                      )
                    : t(
                        { en: "Show all graphs and notes", es: "Ver todos los gráficos y notas" },
                        lang,
                      )}
                </button>
              </div>
              <PollTable polls={visible} lang={lang} open={openNotes} onToggle={toggleNote} />
            </section>

            <section className={`${WRAP} xl:hidden`}>
              <div className="grid gap-x-10 border-b border-line md:grid-cols-2">
                {visible.map((poll) => (
                  <PollCard key={poll.id} poll={poll} lang={lang} />
                ))}
              </div>
            </section>

            <section className={`${WRAP} pt-2 pb-16`}>
              <ul className="columns-1 gap-x-14 border-t border-ink pt-5 text-[13px] leading-[1.55] text-muted md:columns-2">
                <li className="break-inside-avoid pb-2.5">
                  {t(
                    {
                      en: "A dash means “not in this release”, not zero.",
                      es: "Una raya significa «no está en esta entrega», no cero.",
                    },
                    lang,
                  )}
                </li>
                <li className="break-inside-avoid pb-2.5">
                  {t(
                    {
                      en: "CIS printed no seats. Congress is not a national proportional system, so a vote share is not a seat.",
                      es: "El CIS no publicó escaños. El Congreso no es proporcional nacional, así que un porcentaje no es un escaño.",
                    },
                    lang,
                  )}
                </li>
                <li className="break-inside-avoid pb-2.5">
                  {t(
                    {
                      en: "PP + Vox adds the PP and Vox seats each release printed. An asterisk marks a release that printed the pair without a split.",
                      es: "PP + Vox suma los escaños de PP y de Vox que publicó cada entrega. El asterisco marca una entrega que publicó la suma sin reparto.",
                    },
                    lang,
                  )}
                </li>
                <li className="break-inside-avoid pb-2.5">
                  {t(
                    {
                      en: "A model’s simulation intervals are not a poll’s range, so they are not added up in the PP + Vox column.",
                      es: "Los intervalos de simulación de un modelo no son la horquilla de un sondeo, así que no se suman en la columna PP + Vox.",
                    },
                    lang,
                  )}
                </li>
              </ul>
            </section>
          </>
        )}

        {tab === "blocs" && <BlocsView lang={lang} />}

        {tab === "count" && (
          <>
            <section
              className={`${WRAP} flex flex-wrap items-start gap-x-16 gap-y-6 pt-8 pb-12 md:pt-14`}
            >
              <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
                {phaseKicker}
                <h1 className={H1}>
                  {t({ en: "No official 2026 count", es: "Sin escrutinio oficial de 2026" }, lang)}
                </h1>
              </div>
              <div className="flex min-w-0 flex-[1_1_380px] flex-col items-start gap-1">
                <p className="text-[15.5px] leading-[1.6]">
                  {t(
                    {
                      en: "Stations have not reported a 2026 result. This board will not fill itself with a projection dressed up as a count. When Interior publishes the provisional scrutiny, it will be on Infoelectoral. Until then, the only votes on this page are the official result of 23 July 2023.",
                      es: "Las mesas no han dado un resultado de 2026. Este tablero no se rellena con una proyección disfrazada de recuento. Cuando Interior publique el escrutinio provisional, estará en Infoelectoral. Hasta entonces, los únicos votos de esta página son el resultado oficial del 23 de julio de 2023.",
                    },
                    lang,
                  )}
                </p>
                <a
                  className={`${LINK} text-[15px]`}
                  href="https://infoelectoral.interior.gob.es"
                  target="_blank"
                  rel="noreferrer"
                >
                  Infoelectoral
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              </div>
            </section>

            <section className="border-t border-ink">
              <div className={`${WRAP} pt-10 pb-16`}>
                <div className="flex flex-col items-start gap-3">
                  <Badge kind="official" lang={lang} />
                  <Heading icon={Landmark}>
                    {t({ en: "23 July 2023", es: "23 de julio de 2023" }, lang)}
                  </Heading>
                  <p className="max-w-[72ch] text-base leading-[1.6]">
                    {t(
                      {
                        en: `Turnout ${formatPct(RESULT_2023_META.turnoutPct, lang)}%. PP+Vox held ${RESULT_2023_META.ppVox}, six short of 176. Sánchez was invested on ${t(RESULT_2023_META.investitureDate, lang)} with ${RESULT_2023_META.investitureYes} votes.`,
                        es: `Participación ${formatPct(RESULT_2023_META.turnoutPct, lang)}%. PP+Vox sumaron ${RESULT_2023_META.ppVox}, a seis de 176. Sánchez fue investido el ${t(RESULT_2023_META.investitureDate, lang)} con ${RESULT_2023_META.investitureYes} votos.`,
                      },
                      lang,
                    )}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-start gap-x-16 gap-y-10">
                  <figure className="min-w-0 flex-[999_1_560px]">
                    <Hemicycle active={party} lang={lang} />
                    <dl className="mt-7 grid grid-cols-2 gap-x-3 gap-y-5 border-t border-line pt-4 sm:grid-cols-4">
                      {(
                        [
                          [RESULT_2023_META.census, { en: "Census", es: "Censo" }],
                          [RESULT_2023_META.cast, { en: "Votes cast", es: "Votantes" }],
                          [RESULT_2023_META.blank, { en: "Blank", es: "En blanco" }],
                          [RESULT_2023_META.spoilt, { en: "Spoilt", es: "Nulos" }],
                        ] as const
                      ).map(([value, label]) => (
                        <div key={label.en}>
                          <dt className={`${LABEL} text-muted`}>{t(label, lang)}</dt>
                          <dd className="mt-1.5 text-2xl leading-tight font-medium tracking-[-0.03em] tabular-nums">
                            {formatInt(value, lang)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <figcaption className="mt-6 max-w-[80ch] text-[13px] leading-[1.55] text-muted">
                      {t(
                        {
                          en: "Dots are coloured left to right so the result can be read. That is not the chamber’s physical seating. Source: Interior’s official file, as reproduced by compilations that match each other seat for seat.",
                          es: "Los puntos van de izquierda a derecha para poder leer el resultado. No es el hemiciclo físico. Fuente: fichero oficial de Interior, tal como lo reproducen compilaciones que coinciden escaño a escaño.",
                        },
                        lang,
                      )}
                    </figcaption>
                  </figure>

                  <div className="min-w-0 flex-[1_1_380px]">
                    <div
                      className={`${LEDGER_COLS} items-end border-b border-ink pb-2.5 ${LABEL} text-muted`}
                    >
                      <span>{t({ en: "Party", es: "Partido" }, lang)}</span>
                      <span className="text-right">{t({ en: "Seats", es: "Escaños" }, lang)}</span>
                      <span className="text-right">{t({ en: "Votes", es: "Votos" }, lang)}</span>
                      <span className="text-right">%</span>
                    </div>
                    {READ_2023.map((id) => {
                      const block = RESULT_2023.find((b) => b.party === id);
                      if (!block) return null;
                      const on = party === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={on}
                          title={t(PARTIES[id].name, lang)}
                          onClick={() => setParty((cur) => (cur === id ? null : id))}
                          className={`${LEDGER_COLS} h-11 w-full items-center border-b border-line text-left ${
                            on ? "bg-raised" : ""
                          }`}
                        >
                          <span className="flex items-center gap-2.5 pl-1 text-sm font-semibold">
                            <span
                              aria-hidden="true"
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: PARTIES[id].color }}
                            />
                            {PARTIES[id].short}
                          </span>
                          <span className="text-right font-mono text-[13px] font-semibold tabular-nums">
                            {block.seats}
                          </span>
                          <span className="text-right font-mono text-[12.5px] tabular-nums text-muted">
                            {formatInt(block.votes, lang)}
                          </span>
                          <span className="pr-1 text-right font-mono text-[12.5px] tabular-nums text-muted">
                            {formatPct(block.pct, lang)}
                          </span>
                        </button>
                      );
                    })}
                    <div className={`${LEDGER_COLS} h-11 items-center`}>
                      <span className="pl-1 text-sm font-semibold">
                        {t({ en: "Congress", es: "Congreso" }, lang)}
                      </span>
                      <span className="text-right font-mono text-[13px] font-semibold tabular-nums">
                        {CONGRESS}
                      </span>
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "vote" && (
          <>
            <section className={`${WRAP} pt-8 pb-10 md:pt-14`}>
              <Badge kind="law" lang={lang} />
              <h1 className={`mt-4 ${H1}`}>
                {t({ en: "How the vote works", es: "Cómo es el voto" }, lang)}
              </h1>
            </section>

            <section className={`${WRAP} pb-12`}>
              <div className="grid gap-x-16 border-b border-line md:grid-cols-2">
                {RULES.map((rule, index) => {
                  const Icon = RULE_ICONS[index] ?? Vote;
                  return (
                    <article key={rule.title.en} className="border-t border-ink py-6">
                      <h2 className={`flex items-center gap-2.5 ${H3}`}>
                        <Icon
                          className="size-[22px] shrink-0 text-gold-ink"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        {t(rule.title, lang)}
                      </h2>
                      <p className="mt-2 text-[15px] leading-[1.6]">{t(rule.body, lang)}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className={`${WRAP} pb-16`}>
              <Heading icon={MapPin}>
                {t({ en: "Largest constituencies", es: "Circunscripciones mayores" }, lang)}
              </Heading>
              <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-muted">
                {t(
                  {
                    en: "From the annex of RD 806/2026, as reported when the decree was published. Not the full map of 52 districts.",
                    es: "Del anexo del RD 806/2026, según se informó al publicarse el decreto. No es el mapa completo de las 52 circunscripciones.",
                  },
                  lang,
                )}
              </p>
              <ul className="mt-6 grid grid-cols-2 border-y border-ink sm:grid-cols-4">
                {PROVINCES.map((p) => (
                  <li key={p.name.en} className="border-l border-line py-5 pr-1 pl-2.5 md:pl-5">
                    <p className={`text-[40px] ${BIG}`}>{p.seats}</p>
                    <p className={`mt-2.5 flex items-center gap-1.5 ${LABEL}`}>
                      <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                      {t(p.name, lang)}
                    </p>
                    {p.note && <p className="mt-1 text-xs text-gold-ink">{t(p.note, lang)}</p>}
                  </li>
                ))}
              </ul>
              <a
                className={`${LINK} mt-6 text-[15px]`}
                href="https://29neleccionesgenerales.es"
                target="_blank"
                rel="noreferrer"
              >
                {t({ en: "Official how-to-vote site", es: "Web oficial para votar" }, lang)}
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </section>
          </>
        )}

        {tab === "sources" && (
          <>
            <section className={`${WRAP} pt-8 pb-10 md:pt-14`}>
              <h1 className={H1}>
                {t(
                  { en: "What is official, and what is not", es: "Qué es oficial y qué no" },
                  lang,
                )}
              </h1>
              <p className="mt-4 max-w-[75ch] text-base leading-[1.6] text-muted">
                {t(
                  {
                    en: "Official means the state: the decree, the electoral law, the ministry’s count, or the state pollster. Media means a newspaper commissioned a poll. Model means someone averaged or simulated those polls. A model can be careful and still be wrong. None of the three is a ballot.",
                    es: "Oficial significa el Estado: el decreto, la ley electoral, el recuento del ministerio o el instituto público. Medio significa que un periódico encargó un sondeo. Modelo significa que alguien promedió o simuló esos sondeos. Un modelo puede ser cuidadoso y aun así fallar. Ninguno de los tres es una urna.",
                  },
                  lang,
                )}
              </p>
            </section>

            <section className={`${WRAP} pb-16`}>
              <ul className="grid gap-x-16 border-b border-line lg:grid-cols-2">
                {SOURCES.map((source) => (
                  <li
                    key={source.id}
                    className="flex flex-col items-start gap-2 border-t border-ink py-6"
                  >
                    <Badge kind={source.kind === "official" ? "law" : source.kind} lang={lang} />
                    <h2 className={H3}>{source.name}</h2>
                    <p className="max-w-[70ch] text-[15px] leading-[1.6]">{t(source.used, lang)}</p>
                    <a
                      className={`${LINK} text-sm break-all`}
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.href.replace("https://", "")}
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-ink">
        <div className={`${WRAP} pt-8 pb-28 lg:pb-14`}>
          <p className="max-w-[64ch] text-[13px] leading-[1.6] text-muted">
            {t(
              {
                en: "Snapshot compiled the morning of 25 November 2026. The desk clock is live. The numbers are not, until Interior opens the count.",
                es: "Instantánea reunida la mañana del 25 de noviembre de 2026. El reloj de la mesa está en directo. Las cifras no, hasta que Interior abra el recuento.",
              },
              lang,
            )}
          </p>
        </div>
      </footer>

      <Nav tab={tab} lang={lang} variant="dock" />
    </div>
  );
}
