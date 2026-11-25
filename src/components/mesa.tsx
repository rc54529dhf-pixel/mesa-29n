import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Clock,
  Columns3,
  ExternalLink,
  Landmark,
  ScrollText,
  Vote,
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
} from "@/data/election";

type Tab = "now" | "polls" | "blocs" | "count" | "vote" | "sources";
type Filter = "all" | Kind;

const TABS: { id: Tab; icon: typeof Clock; label: Bi }[] = [
  { id: "now", icon: Clock, label: { en: "Now", es: "Ahora" } },
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

const FILTERS: { id: Filter; label: Bi }[] = [
  { id: "all", label: { en: "All", es: "Todos" } },
  { id: "official-poll", label: { en: "Official", es: "Oficial" } },
  { id: "media", label: { en: "Media", es: "Medios" } },
  { id: "model", label: { en: "Models", es: "Modelos" } },
];

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

function Badge({ kind, lang }: { kind: Kind | "official" | "law"; lang: Lang }) {
  const label =
    kind === "official"
      ? t({ en: "Official · count", es: "Oficial · recuento" }, lang)
      : kind === "law"
        ? t({ en: "Official · law", es: "Oficial · norma" }, lang)
        : t(KIND_LABEL[kind], lang);
  const tone =
    kind === "media"
      ? "border-ink text-ink"
      : kind === "model"
        ? "border-dashed border-muted text-muted"
        : "border-brass bg-brass-soft text-brass";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

function ShareBars({ shares, lang }: { shares: Poll["shares"]; lang: Lang }) {
  if (shares.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {shares.map((share) => (
        <li key={share.party} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-sm font-semibold">{PARTIES[share.party].short}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper-2" aria-hidden="true">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, (share.pct / 40) * 100)}%`,
                background: PARTIES[share.party].color,
              }}
            />
          </span>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums">{formatPct(share.pct, lang)}%</span>
        </li>
      ))}
    </ul>
  );
}

function SeatChips({ seats, lang }: { seats: Poll["seats"]; lang: Lang }) {
  if (seats.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {seats.map((seat) => (
        <li
          key={seat.party}
          className="flex items-center gap-2 rounded-full border border-line bg-paper px-2 py-1 text-sm"
        >
          <span className="size-2.5 rounded-full" style={{ background: PARTIES[seat.party].color }} />
          <span className="font-semibold">{PARTIES[seat.party].short}</span>
          <span className="tabular-nums">{seatLabel(seat.low, seat.high)}</span>
          <span className="text-muted">{t({ en: "seats", es: "esc." }, lang)}</span>
        </li>
      ))}
    </ul>
  );
}

function PollCard({ poll, lang }: { poll: Poll; lang: Lang }) {
  const source = sourceById(poll.sourceId);
  return (
    <article className="rounded-card border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind={poll.kind} lang={lang} />
        <span className="text-sm text-muted">{t(poll.when, lang)}</span>
      </div>
      <h3 className="mt-2 font-display text-2xl leading-tight">{poll.pollster}</h3>
      <p className="text-sm text-muted">
        {poll.outlet}
        {poll.sample ? ` · ${t(poll.sample, lang)}` : ""}
      </p>
      <ShareBars shares={poll.shares} lang={lang} />
      <SeatChips seats={poll.seats} lang={lang} />
      <p className="mt-3 text-sm leading-relaxed text-ink">{t(poll.extra, lang)}</p>
      <a
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline decoration-brass underline-offset-2"
        href={source.href}
        target="_blank"
        rel="noreferrer"
      >
        {source.name}
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </article>
  );
}

function Hemicycle({
  active,
  onPick,
  lang,
}: {
  active: PartyId | null;
  onPick: (id: PartyId) => void;
  lang: Lang;
}) {
  const dots = useMemo(() => {
    const sequence: PartyId[] = [];
    for (const id of READ_2023) {
      const block = RESULT_2023.find((b) => b.party === id);
      if (!block) continue;
      for (let i = 0; i < block.seats; i += 1) sequence.push(id);
    }
    const rows = rowCounts(sequence.length, 9);
    const placed: { x: number; y: number; party: PartyId; i: number }[] = [];
    let cursor = 0;
    const cx = 180;
    const cy = 178;
    rows.forEach((count, r) => {
      const radius = 38 + r * 15;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.PI * (1 - (i + 0.5) / count);
        placed.push({
          x: cx + Math.cos(angle) * radius,
          y: cy - Math.sin(angle) * radius,
          party: sequence[cursor] ?? "other",
          i: cursor,
        });
        cursor += 1;
      }
    });
    return placed;
  }, []);

  return (
    <figure>
      <svg viewBox="0 0 360 196" role="img" className="w-full">
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
              r={3.3}
              fill={PARTIES[dot.party].color}
              opacity={dim ? 0.18 : 1}
            />
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {RESULT_2023.map((b) => `${PARTIES[b.party].short} ${b.seats}`).join(", ")}
      </figcaption>
      <div className="mt-2 flex flex-wrap gap-2">
        {READ_2023.map((id) => {
          const block = RESULT_2023.find((b) => b.party === id);
          if (!block) return null;
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              aria-pressed={on}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${
                on ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"
              }`}
            >
              <span className="size-2.5 rounded-full" style={{ background: PARTIES[id].color }} />
              {PARTIES[id].short}
              <span className="tabular-nums">{block.seats}</span>
            </button>
          );
        })}
      </div>
    </figure>
  );
}

function partyShorts(ids: PartyId[]): string {
  return ids.map((id) => PARTIES[id].short).join(" · ");
}

function WingBar({
  parts,
}: {
  parts: { key: string; pct: number; color: string }[];
}) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-paper-2" aria-hidden="true">
      {parts.map((part) =>
        part.pct > 0 ? (
          <span key={part.key} className="h-full" style={{ width: `${part.pct}%`, background: part.color }} />
        ) : null,
      )}
    </div>
  );
}

function BlocsView({ lang, onPolls }: { lang: Lang; onPolls: () => void }) {
  const official = resultByWing();
  const model = POLLS.find((poll) => poll.id === "votantonio");
  const modelSlices = model ? slicesOf(model) : null;
  const seatParts = official.map((wing) => ({
    key: wing.id,
    pct: (wing.seats / CONGRESS) * 100,
    color: WINGS[wing.id].color,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge kind="official" lang={lang} />
          <Badge kind="model" lang={lang} />
        </div>
        <h2 className="mt-2 font-display text-3xl">
          {t({ en: "Left, center, right", es: "Izquierda, centro, derecha" }, lang)}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {t(
            {
              en: "A reading aid, not an official label. Interior does not publish results in three wings. The 2023 seats below are the ministry’s count, regrouped. The poll rows only add parties that release actually printed. A dash means “not in this release”, not zero.",
              es: "Una ayuda para leer, no una etiqueta oficial. Interior no publica los resultados en tres bloques. Los escaños de 2023 son el recuento del ministerio, reagrupado. Las filas de sondeos solo suman los partidos que esa entrega publicó. Una raya significa «no está en esta entrega», no cero.",
            },
            lang,
          )}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {official.map((wing) => (
          <article key={wing.id} className="rounded-card border border-line bg-paper p-4">
            <span className="block h-1.5 w-10 rounded-full" style={{ background: WINGS[wing.id].color }} />
            <h3 className="mt-3 font-display text-2xl">{t(WINGS[wing.id].label, lang)}</h3>
            <p className="font-display text-5xl tabular-nums leading-none">{wing.seats}</p>
            <p className="mt-1 text-sm text-muted">
              {t({ en: "seats in 2023", es: "escaños en 2023" }, lang)}
              {" · "}
              {formatPct(wing.pct, lang)}%
            </p>
            <p className="mt-2 text-sm font-semibold">{partyShorts(wing.parties)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(WINGS[wing.id].blurb, lang)}</p>
          </article>
        ))}
      </div>

      <section className="rounded-card border border-line bg-paper p-4">
        <h3 className="font-display text-2xl">
          {t({ en: "2023 Congress, by wing", es: "Congreso de 2023, por bloque" }, lang)}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t(
            {
              en: "166 left, 13 center, 171 right. That is all 350 seats. The vote shares are of valid ballots. About 3.3 points went to lists that won no seat, plus blank ballots, so the three wings do not add up to 100.",
              es: "166 la izquierda, 13 el centro, 171 la derecha. Son los 350 escaños. Los porcentajes son sobre votos válidos. Unos 3,3 puntos fueron a listas sin escaño, más el voto en blanco, así que los tres bloques no suman 100.",
            },
            lang,
          )}
        </p>
        <div className="mt-4">
          <WingBar parts={seatParts} />
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-sm">
          {official.map((wing) => (
            <li key={wing.id}>
              <span className="font-semibold" style={{ color: WINGS[wing.id].color }}>
                {t(WINGS[wing.id].label, lang)}
              </span>
              <span className="mt-0.5 block tabular-nums">
                {wing.seats} · {formatPct(wing.pct, lang)}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      {model && modelSlices && (
        <section className="rounded-card border border-line bg-paper p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge kind="model" lang={lang} />
            <h3 className="font-display text-2xl">
              {t({ en: "Against one full model", es: "Frente a un modelo completo" }, lang)}
            </h3>
          </div>
          <p className="mt-1 text-sm leading-relaxed">
            {t(
              {
                en: "VotAntonio, 23 November, is the only frozen source here that prints both a national share and a seat for almost every list. It is an informal average of 109 polls, not a count. Its seat rows add up to 349.",
                es: "VotAntonio, 23 de noviembre, es la única fuente congelada aquí que da porcentaje nacional y escaños de casi todas las listas. Es una media informal de 109 sondeos, no un recuento. Sus filas de escaños suman 349.",
              },
              lang,
            )}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs tracking-wide text-muted uppercase">
                  <th className="py-2 pr-3 font-semibold">{t({ en: "Wing", es: "Bloque" }, lang)}</th>
                  <th className="py-2 pr-3 font-semibold">{t({ en: "2023 seats", es: "Escaños 2023" }, lang)}</th>
                  <th className="py-2 pr-3 font-semibold">{t({ en: "Model seats", es: "Escaños modelo" }, lang)}</th>
                  <th className="py-2 font-semibold">{t({ en: "Model vote", es: "Voto modelo" }, lang)}</th>
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
                    <tr key={wing.id} className="border-b border-line last:border-0">
                      <th className="py-3 pr-3 font-semibold" style={{ color: WINGS[wing.id].color }}>
                        {t(WINGS[wing.id].label, lang)}
                      </th>
                      <td className="py-3 pr-3 tabular-nums">{wing.seats}</td>
                      <td className="py-3 pr-3 tabular-nums">
                        {slice.low === null ? "—" : seatLabel(slice.low, slice.high ?? slice.low)}
                        {delta !== null && (
                          <span className="ml-2 text-muted">
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </td>
                      <td className="py-3 tabular-nums">
                        {slice.pct === null ? "—" : `${formatPct(slice.pct, lang)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {t(
              {
                en: "In that model the right is PP 131, Vox 62 and SALF on the vote share only (2.0%, no seat row). The left is PSOE 114, Frente Amplio 9, ERC 10, EH Bildu 7, Front Valencià 4, BNG 2 and Podemos on the vote share only. Center is Junts 5, PNV 4, Coalición Canaria 1.",
                es: "En ese modelo la derecha es PP 131, Vox 62 y SALF solo en voto (2,0%, sin fila de escaños). La izquierda es PSOE 114, Frente Amplio 9, ERC 10, EH Bildu 7, Front Valencià 4, BNG 2 y Podemos solo en voto. El centro es Junts 5, PNV 4, Coalición Canaria 1.",
              },
              lang,
            )}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-display text-2xl">
            {t({ en: "Every frozen release", es: "Cada entrega congelada" }, lang)}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {t(
              {
                en: "Most newspapers only printed PP, PSOE and Vox. Their “left” cell is then PSOE alone, and their “right” cell is PP+Vox. That is not the whole wing. CIS printed no seats. Congress is not a national proportional system, so a vote share is not a seat.",
                es: "La mayoría de los periódicos solo publicó PP, PSOE y Vox. Su celda de izquierda es entonces solo el PSOE, y la de derecha es PP+Vox. Eso no es el bloque entero. El CIS no publicó escaños. El Congreso no es proporcional nacional, así que un porcentaje no es un escaño.",
              },
              lang,
            )}
          </p>
        </div>
        {POLLS.map((poll) => (
          <PollWingRow key={poll.id} poll={poll} lang={lang} />
        ))}
        <button
          type="button"
          onClick={onPolls}
          className="min-h-11 self-start text-sm font-semibold underline decoration-brass underline-offset-2"
        >
          {t({ en: "Open the poll cards", es: "Abrir las fichas de sondeos" }, lang)}
        </button>
      </section>
    </div>
  );
}

function PollWingRow({ poll, lang }: { poll: Poll; lang: Lang }) {
  const slices = slicesOf(poll);
  const other = otherShare(poll);
  const shareParts: { key: string; pct: number; color: string }[] = WING_ORDER.map((id) => ({
    key: id,
    pct: slices[id].pct ?? 0,
    color: WINGS[id].color,
  }));
  if (other > 0) shareParts.push({ key: "other", pct: other, color: "var(--color-other)" });
  const printed = shareParts.reduce((sum, part) => sum + part.pct, 0);
  const hasShares = printed > 0;

  return (
    <article className="rounded-card border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind={poll.kind} lang={lang} />
        <h4 className="font-semibold">
          {poll.pollster}
          <span className="font-normal text-muted"> · {poll.outlet}</span>
        </h4>
      </div>
      <p className="mt-1 text-xs text-muted">{t(poll.when, lang)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {WING_ORDER.map((id) => {
          const slice = slices[id];
          return (
            <div key={id}>
              <dt className="text-xs font-semibold tracking-wide uppercase" style={{ color: WINGS[id].color }}>
                {t(WINGS[id].label, lang)}
              </dt>
              <dd className="mt-1 font-display text-2xl tabular-nums leading-none">
                {slice.pct === null ? "—" : `${formatPct(slice.pct, lang)}%`}
              </dd>
              <p className="mt-1 text-xs tabular-nums text-muted">
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
        <div className="mt-3">
          <WingBar parts={shareParts} />
          <p className="mt-1 text-xs text-muted">
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
    </article>
  );
}

function Nav({
  tab,
  setTab,
  lang,
  className,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  lang: Lang;
  className: string;
}) {
  return (
    <nav className={className} aria-label={t({ en: "Sections", es: "Secciones" }, lang)}>
      {TABS.map((item) => {
        const Icon = item.icon;
        const on = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => setTab(item.id)}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-card px-0.5 text-xs font-semibold tracking-tight md:flex-row md:gap-2 md:px-3 md:text-sm ${
              on ? "bg-ink text-paper" : "text-muted"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(item.label, lang)}
          </button>
        );
      })}
    </nav>
  );
}

export function Mesa() {
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("now");
  const [now, setNow] = useState<Date | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [party, setParty] = useState<PartyId | null>("pp");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mesa-lang");
    if (saved === "es" || saved === "en") setLang(saved);
    setReady(true);
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("mesa-lang", lang);
    document.documentElement.lang = lang;
  }, [lang, ready]);

  const choose = (next: Tab) => {
    setTab(next);
    window.scrollTo(0, 0);
  };

  const stamp = now?.getTime() ?? Date.parse("2026-11-25T09:05:00+01:00");
  const phase = phaseAt(stamp);
  const silence = pollSilence(stamp);
  const target = countdownTarget(phase);
  const remain = target && now ? splitRemaining(target.at - now.getTime()) : null;
  const bloc = rightBlocSpan();
  const selected = party ? RESULT_2023.find((b) => b.party === party) : undefined;
  const visible = POLLS.filter((p) => filter === "all" || p.kind === filter);

  const copyStatus = async () => {
    const lines = [
      "Mesa 29N",
      t(PHASE_LABEL[phase], lang),
      silence
        ? t(
            {
              en: "Poll publication ban in force in Spain.",
              es: "Veda de publicación de sondeos en vigor en España.",
            },
            lang,
          )
        : t({ en: "Poll ban has ended.", es: "La veda de sondeos ha terminado." }, lang),
      t(
        {
          en: "No official 2026 count on this desk. Last official Congress result is 23 July 2023.",
          es: "No hay escrutinio oficial de 2026 en esta mesa. El último resultado oficial del Congreso es el 23 de julio de 2023.",
        },
        lang,
      ),
      "https://infoelectoral.interior.gob.es",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="h-1 bg-crimson" />
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brass uppercase">
              {t({ en: "Spain · Congress and Senate", es: "España · Congreso y Senado" }, lang)}
            </p>
            <h1 className="font-display text-4xl leading-none">Mesa 29N</h1>
            <p className="mt-1 text-sm text-muted">
              {t(
                {
                  en: "Election day is Sunday 29 November 2026.",
                  es: "La jornada electoral es el domingo 29 de noviembre de 2026.",
                },
                lang,
              )}
            </p>
            <p className="text-sm text-muted">
              {now
                ? madridClock(now, lang)
                : t({ en: "Madrid time", es: "Hora de Madrid" }, lang)}
              {" · "}
              {t(PHASE_LABEL[phase], lang)}
            </p>
          </div>
          <div className="flex rounded-full border border-line p-1">
            {(["en", "es"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold ${
                  lang === code ? "bg-ink text-paper" : "text-muted"
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <Nav
          tab={tab}
          setTab={choose}
          lang={lang}
          className="mx-auto hidden w-full max-w-5xl gap-1 px-4 pb-3 md:flex"
        />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:pb-12">
        {tab === "now" && (
          <div className="flex flex-col gap-4">
            {silence && (
              <section className="rounded-card border border-brass bg-brass-soft p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge kind="law" lang={lang} />
                  <ScrollText className="size-4 text-brass" aria-hidden="true" />
                </div>
                <h2 className="mt-2 font-display text-2xl">
                  {t({ en: "Poll silence is in force", es: "La veda de sondeos está en vigor" }, lang)}
                </h2>
                <p className="mt-1 text-sm leading-relaxed">
                  {t(
                    {
                      en: "Spanish law stops outlets in Spain publishing voting-intention polls during the five days before the election. The figures below are frozen on fieldwork that closed by 23 November. They are not votes, and they are not a count.",
                      es: "La ley impide a los medios en España publicar sondeos de intención de voto durante los cinco días previos. Las cifras de abajo están congeladas en el trabajo de campo cerrado el 23 de noviembre. No son votos y no son un recuento.",
                    },
                    lang,
                  )}
                </p>
              </section>
            )}

            <section className="rounded-card bg-ink p-4 text-paper">
              <p className="text-xs font-semibold tracking-widest text-paper/70 uppercase">
                {target ? t(target.label, lang) : t({ en: "Scrutiny window", es: "Ventana de escrutinio" }, lang)}
              </p>
              {remain ? (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {(
                    [
                      [remain.d, { en: "Days", es: "Días" }],
                      [remain.h, { en: "Hours", es: "Horas" }],
                      [remain.m, { en: "Min", es: "Min" }],
                      [remain.s, { en: "Sec", es: "Seg" }],
                    ] as const
                  ).map(([value, label]) => (
                    <div key={label.en} className="rounded-card bg-paper/10 px-1 py-3 text-center">
                      <div className="font-display text-4xl leading-none tabular-nums">{value}</div>
                      <div className="mt-1 text-xs text-paper/70">{t(label, lang)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 font-display text-3xl">
                  {t(
                    {
                      en: "Provisional count can start. This desk does not invent one.",
                      es: "El escrutinio provisional puede empezar. Esta mesa no se lo inventa.",
                    },
                    lang,
                  )}
                </p>
              )}
              <p className="mt-3 text-sm text-paper/80">
                {t(
                  {
                    en: "Sunday 29 November. Stations open 09:00–20:00. Majority in Congress: 176 of 350. Directly elected senators: 209.",
                    es: "Domingo 29 de noviembre. Colegios de 09:00 a 20:00. Mayoría en el Congreso: 176 de 350. Senadores de elección directa: 209.",
                  },
                  lang,
                )}
              </p>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-card border border-line bg-paper p-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {t({ en: "Congress", es: "Congreso" }, lang)}
                </p>
                <p className="font-display text-4xl tabular-nums">{CONGRESS}</p>
                <p className="text-sm text-muted">{t({ en: "deputies", es: "diputados" }, lang)}</p>
              </article>
              <article className="rounded-card border border-line bg-paper p-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {t({ en: "Majority", es: "Mayoría" }, lang)}
                </p>
                <p className="font-display text-4xl tabular-nums text-crimson">{MAJORITY}</p>
                <p className="text-sm text-muted">{t({ en: "votes to invest, first round", es: "votos para investir, primera" }, lang)}</p>
              </article>
              <article className="rounded-card border border-line bg-paper p-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {t({ en: "Senate, direct", es: "Senado, directo" }, lang)}
                </p>
                <p className="font-display text-4xl tabular-nums">{SENATE_DIRECT}</p>
                <p className="text-sm text-muted">{t({ en: "on this ballot", es: "en esta papeleta" }, lang)}</p>
              </article>
            </section>

            {bloc && (
              <section className="rounded-card border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge kind="media" lang={lang} />
                  <h2 className="font-display text-2xl">
                    {t({ en: "PP + Vox seat spread", es: "Horquilla de escaños PP + Vox" }, lang)}
                  </h2>
                </div>
                <p className="mt-2 font-display text-4xl tabular-nums">
                  {bloc.low}–{bloc.high}
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {t(
                    {
                      en: `Sum of the published lows, and sum of the published highs, across ${bloc.n} media polls that printed both parties. This is not a joint forecast and not an average. Reuters said on 23 November that all surveys but one put the two parties together above 176. IMOP, which did not split them, had the pair on 195.`,
                      es: `Suma de los suelos publicados y suma de los techos publicados, en ${bloc.n} sondeos de medios que daban a los dos partidos. No es un pronóstico conjunto ni una media. Reuters dijo el 23 de noviembre que todas las encuestas menos una ponían a los dos por encima de 176. IMOP, que no los separaba, los situaba en 195.`,
                    },
                    lang,
                  )}
                </p>
                <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-paper-2" aria-hidden="true">
                  <span
                    className="absolute inset-y-0 bg-ink/80"
                    style={{
                      left: `${(bloc.low / CONGRESS) * 100}%`,
                      width: `${((bloc.high - bloc.low) / CONGRESS) * 100}%`,
                    }}
                  />
                  <span
                    className="absolute inset-y-0 w-0.5 bg-crimson"
                    style={{ left: `${(MAJORITY / CONGRESS) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {t({ en: "The red line is 176.", es: "La línea roja es 176." }, lang)}
                </p>
                <button
                  type="button"
                  onClick={() => choose("blocs")}
                  className="mt-3 min-h-11 text-sm font-semibold underline decoration-brass underline-offset-2"
                >
                  {t(
                    {
                      en: "See left, center and right",
                      es: "Ver izquierda, centro y derecha",
                    },
                    lang,
                  )}
                </button>
              </section>
            )}

            <section>
              <h2 className="font-display text-2xl">
                {t({ en: "Who is standing", es: "Quién se presenta" }, lang)}
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {CANDIDATES.map((c) => (
                  <li key={c.party} className="rounded-card border border-line bg-paper p-4">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ background: PARTIES[c.party].color }} />
                      <span className="text-sm font-semibold">{PARTIES[c.party].short}</span>
                    </div>
                    <p className="mt-1 font-display text-2xl leading-tight">{c.name}</p>
                    <p className="text-sm text-muted">{t(c.role, lang)}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl">{t({ en: "Calendar", es: "Calendario" }, lang)}</h2>
              <ol className="mt-3 flex flex-col">
                {CALENDAR.map((item) => {
                  const tone = calendarTone(item.id, stamp);
                  return (
                    <li key={item.id} className="flex gap-3 border-t border-line py-3">
                      <span
                        className={`mt-1 size-2.5 shrink-0 rounded-full ${
                          tone === "now" ? "bg-crimson" : tone === "past" ? "bg-line" : "bg-brass"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-semibold">
                          {t(item.when, lang)}
                          <span className="ml-2 text-xs font-semibold tracking-wide text-muted uppercase">
                            {tone === "now"
                              ? t({ en: "Now", es: "Ahora" }, lang)
                              : tone === "past"
                                ? t({ en: "Passed", es: "Pasado" }, lang)
                                : t({ en: "Ahead", es: "Por venir" }, lang)}
                          </span>
                        </p>
                        <p className="text-sm leading-relaxed">{t(item.what, lang)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <button
              type="button"
              onClick={copyStatus}
              className="min-h-11 rounded-card bg-crimson px-4 text-sm font-semibold text-on-crimson"
            >
              {copied
                ? t({ en: "Copied", es: "Copiado" }, lang)
                : t({ en: "Copy a source-safe status", es: "Copiar un estado con fuentes" }, lang)}
            </button>
          </div>
        )}

        {tab === "polls" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-display text-3xl">
                {t({ en: "Last polls before the ban", es: "Últimos sondeos antes de la veda" }, lang)}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
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
              className="rounded-card bg-ink p-1"
              role="group"
              aria-label={t({ en: "Which polls to show", es: "Qué sondeos mostrar" }, lang)}
            >
              <div className="grid grid-cols-4 gap-1">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`min-h-11 rounded-card px-1 text-sm font-semibold ${
                      filter === item.id ? "bg-paper text-ink" : "text-paper/80"
                    }`}
                  >
                    {t(item.label, lang)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((poll) => (
                <PollCard key={poll.id} poll={poll} lang={lang} />
              ))}
            </div>
          </div>
        )}

        {tab === "blocs" && <BlocsView lang={lang} onPolls={() => choose("polls")} />}

        {tab === "count" && (
          <div className="flex flex-col gap-4">
            <section className="rounded-card border border-crimson bg-paper p-4">
              <h2 className="font-display text-3xl">
                {t({ en: "No official 2026 count", es: "Sin escrutinio oficial de 2026" }, lang)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed">
                {t(
                  {
                    en: "Stations have not reported a 2026 result. This board will not fill itself with a projection dressed up as a count. When Interior publishes the provisional scrutiny, it will be on Infoelectoral. Until then, the only votes on this page are the official result of 23 July 2023.",
                    es: "Las mesas no han dado un resultado de 2026. Este tablero no se rellena con una proyección disfrazada de recuento. Cuando Interior publique el escrutinio provisional, estará en Infoelectoral. Hasta entonces, los únicos votos de esta página son el resultado oficial del 23 de julio de 2023.",
                  },
                  lang,
                )}
              </p>
              <a
                className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-brass underline-offset-2"
                href="https://infoelectoral.interior.gob.es"
                target="_blank"
                rel="noreferrer"
              >
                Infoelectoral
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </section>

            <section className="rounded-card border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge kind="official" lang={lang} />
                <h2 className="font-display text-2xl">
                  {t({ en: "23 July 2023", es: "23 de julio de 2023" }, lang)}
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                {t(
                  {
                    en: `Turnout ${formatPct(RESULT_2023_META.turnoutPct, lang)}%. PP+Vox held ${RESULT_2023_META.ppVox}, six short of 176. Sánchez was invested on ${t(RESULT_2023_META.investitureDate, lang)} with ${RESULT_2023_META.investitureYes} votes.`,
                    es: `Participación ${formatPct(RESULT_2023_META.turnoutPct, lang)}%. PP+Vox sumaron ${RESULT_2023_META.ppVox}, a seis de 176. Sánchez fue investido el ${t(RESULT_2023_META.investitureDate, lang)} con ${RESULT_2023_META.investitureYes} votos.`,
                  },
                  lang,
                )}
              </p>
              <div className="mt-4">
                <Hemicycle
                  active={party}
                  onPick={(id) => setParty((cur) => (cur === id ? null : id))}
                  lang={lang}
                />
              </div>
              {selected && (
                <p className="mt-3 text-sm leading-relaxed">
                  <span className="font-semibold">{t(PARTIES[selected.party].name, lang)}</span>
                  {" · "}
                  {formatInt(selected.votes, lang)}{" "}
                  {t({ en: "votes", es: "votos" }, lang)} ({formatPct(selected.pct, lang)}%) ·{" "}
                  {selected.seats} {t({ en: "seats", es: "escaños" }, lang)}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {(
                  [
                    [RESULT_2023_META.census, { en: "Census", es: "Censo" }],
                    [RESULT_2023_META.cast, { en: "Votes cast", es: "Votantes" }],
                    [RESULT_2023_META.blank, { en: "Blank", es: "En blanco" }],
                    [RESULT_2023_META.spoilt, { en: "Spoilt", es: "Nulos" }],
                  ] as const
                ).map(([value, label]) => (
                  <div key={label.en}>
                    <dt className="text-muted">{t(label, lang)}</dt>
                    <dd className="font-display text-2xl tabular-nums">{formatInt(value, lang)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">
                {t(
                  {
                    en: "Dots are coloured left to right so the result can be read. That is not the chamber’s physical seating. Source: Interior’s official file, as reproduced by compilations that match each other seat for seat.",
                    es: "Los puntos van de izquierda a derecha para poder leer el resultado. No es el hemiciclo físico. Fuente: fichero oficial de Interior, tal como lo reproducen compilaciones que coinciden escaño a escaño.",
                  },
                  lang,
                )}
              </p>
            </section>
          </div>
        )}

        {tab === "vote" && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge kind="law" lang={lang} />
              </div>
              <h2 className="mt-2 font-display text-3xl">
                {t({ en: "How the vote works", es: "Cómo es el voto" }, lang)}
              </h2>
            </div>
            <div className="grid gap-3">
              {RULES.map((rule) => (
                <article key={rule.title.en} className="rounded-card border border-line bg-paper p-4">
                  <h3 className="font-display text-2xl">{t(rule.title, lang)}</h3>
                  <p className="mt-1 text-sm leading-relaxed">{t(rule.body, lang)}</p>
                </article>
              ))}
            </div>
            <section>
              <h2 className="font-display text-2xl">
                {t({ en: "Largest constituencies", es: "Circunscripciones mayores" }, lang)}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {t(
                  {
                    en: "From the annex of RD 806/2026, as reported when the decree was published. Not the full map of 52 districts.",
                    es: "Del anexo del RD 806/2026, según se informó al publicarse el decreto. No es el mapa completo de las 52 circunscripciones.",
                  },
                  lang,
                )}
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROVINCES.map((p) => (
                  <li key={p.name.en} className="rounded-card border border-line bg-paper p-3">
                    <p className="text-sm">{t(p.name, lang)}</p>
                    <p className="font-display text-3xl tabular-nums">{p.seats}</p>
                    {p.note && <p className="text-xs text-brass">{t(p.note, lang)}</p>}
                  </li>
                ))}
              </ul>
            </section>
            <a
              className="inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-brass underline-offset-2"
              href="https://29neleccionesgenerales.es"
              target="_blank"
              rel="noreferrer"
            >
              {t({ en: "Official how-to-vote site", es: "Web oficial para votar" }, lang)}
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        )}

        {tab === "sources" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-display text-3xl">
                {t({ en: "What is official, and what is not", es: "Qué es oficial y qué no" }, lang)}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t(
                  {
                    en: "Official means the state: the decree, the electoral law, the ministry’s count, or the state pollster. Media means a newspaper commissioned a poll. Model means someone averaged or simulated those polls. A model can be careful and still be wrong. None of the three is a ballot.",
                    es: "Oficial significa el Estado: el decreto, la ley electoral, el recuento del ministerio o el instituto público. Medio significa que un periódico encargó un sondeo. Modelo significa que alguien promedió o simuló esos sondeos. Un modelo puede ser cuidadoso y aun así fallar. Ninguno de los tres es una urna.",
                  },
                  lang,
                )}
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {SOURCES.map((source) => (
                <li key={source.id} className="rounded-card border border-line bg-paper p-4">
                  <Badge
                    kind={source.kind === "official" ? "law" : source.kind}
                    lang={lang}
                  />
                  <h3 className="mt-2 font-display text-2xl">{source.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed">{t(source.used, lang)}</p>
                  <a
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline decoration-brass underline-offset-2"
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.href.replace("https://", "")}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-muted">
              {t(
                {
                  en: "Snapshot compiled the morning of 25 November 2026. The desk clock is live. The numbers are not, until Interior opens the count.",
                  es: "Instantánea reunida la mañana del 25 de noviembre de 2026. El reloj de la mesa está en directo. Las cifras no, hasta que Interior abra el recuento.",
                },
                lang,
              )}
            </p>
          </div>
        )}
      </main>

      <Nav
        tab={tab}
        setTab={choose}
        lang={lang}
        className="dock fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper px-2 pt-1 md:hidden"
      />
    </div>
  );
}
