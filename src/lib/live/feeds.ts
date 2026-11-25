/**
 * Headline feeds for the Live page.
 *
 * The desk reads each outlet's own public news feed, keeps the items about the
 * election, and shows the headline, the outlet, the time and a link back to the
 * outlet. No article text is stored or shown.
 *
 * Everything here is pure, so it can be tested without a network.
 */

export type LiveOutlet = {
  id: string;
  name: string;
  /** Links are only accepted when they point at this domain. */
  domain: string;
  /** Tried in order; the first feed that answers with items is used. */
  feeds: string[];
};

export const LIVE_OUTLETS: LiveOutlet[] = [
  {
    id: "elpais",
    name: "EL PAÍS",
    domain: "elpais.com",
    feeds: [
      "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada",
      "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ultimas-noticias/portada",
    ],
  },
  {
    id: "elmundo",
    name: "El Mundo",
    domain: "elmundo.es",
    feeds: [
      "https://estaticos.elmundo.es/elmundo/rss/espana.xml",
      "https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml",
    ],
  },
  {
    id: "abc",
    name: "ABC",
    domain: "abc.es",
    feeds: ["https://www.abc.es/rss/feeds/abc_EspanaEspana.xml"],
  },
  {
    id: "elconfidencial",
    name: "El Confidencial",
    domain: "elconfidencial.com",
    feeds: ["https://rss.elconfidencial.com/espana/"],
  },
  {
    id: "elespanol",
    name: "El Español",
    domain: "elespanol.com",
    feeds: ["https://www.elespanol.com/rss/espana"],
  },
  {
    id: "europapress",
    name: "Europa Press",
    domain: "europapress.es",
    feeds: ["https://www.europapress.es/rss/rss.aspx?ch=66"],
  },
];

export type LiveItem = {
  id: string;
  /** Outlet display name. */
  outlet: string;
  title: string;
  /** Machine translation of the headline into English, when one is available. */
  titleEn?: string;
  url: string;
  /** Publication time, milliseconds since the epoch. */
  at: number;
  /**
   * The headline itself is about the vote, or the outlet filed it under its
   * election section. The one-line strip on the first page only uses these.
   */
  core: boolean;
};

export type LiveSource = {
  id: string;
  name: string;
  /** The outlet's feed answered and could be read. */
  ok: boolean;
  /** Election headlines kept from it. */
  kept: number;
};

/** How the English headlines stand; for checking the service, not shown to readers. */
export type LiveTranslation = {
  translated: number;
  pending: number;
  /** "shared": translations are kept across server instances. "instance": only in this one. */
  store: "shared" | "instance";
  note: string;
};

export type LivePayload = {
  fetchedAt: number;
  items: LiveItem[];
  sources: LiveSource[];
  translation?: LiveTranslation;
};

export type RawEntry = {
  title: string;
  link: string;
  date: string;
  /** Summary and category text, used only to decide whether the item is about the election. */
  context: string;
};

const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const FUTURE_SLACK_MS = 10 * 60 * 1000;
const PER_OUTLET = 25;
const TOTAL = 80;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  ccedil: "ç",
  Ccedil: "Ç",
  agrave: "à",
  egrave: "è",
  ograve: "ò",
  iquest: "¿",
  iexcl: "¡",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  euro: "€",
  ordf: "ª",
  ordm: "º",
  middot: "·",
};

function decodeEntitiesOnce(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** Plain text from a feed field: CDATA unwrapped, tags removed, entities decoded. */
export function cleanText(value: string): string {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Feeds often escape their markup, so decode first, strip tags, then decode once more.
  text = decodeEntitiesOnce(text);
  text = text.replace(/<[^>]*>/g, " ");
  text = decodeEntitiesOnce(text);
  return text
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Decodes feed bytes using the charset the feed declares; several Spanish feeds are Latin-9. */
export function decodeFeed(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 300));
  const declared =
    /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(head)?.[1] ??
    /charset=["']?([^"';\s]+)/i.exec(contentType ?? "")?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(declared.trim().toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function field(block: string, names: string[]): string {
  for (const name of names) {
    const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
    if (match && match[1].trim()) return match[1];
  }
  return "";
}

function atomLink(block: string): string {
  const links = block.match(/<link\b[^>]*>/gi) ?? [];
  let fallback = "";
  for (const tag of links) {
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    const rel = /\brel=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!rel || rel === "alternate") return href;
    if (!fallback) fallback = href;
  }
  return fallback;
}

/** Reads RSS 2.0 `<item>` and Atom `<entry>` blocks. Tolerant: a malformed block is skipped. */
export function parseFeed(xml: string): RawEntry[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const entries: RawEntry[] = [];
  for (const block of blocks) {
    const title = cleanText(field(block, ["title"]));
    const link =
      cleanText(field(block, ["link"])) ||
      cleanText(atomLink(block)) ||
      cleanText(field(block, ["guid"]));
    const date = cleanText(field(block, ["pubDate", "dc:date", "published", "updated"]));
    const categories = (block.match(/<category\b[^>]*>[\s\S]*?<\/category>/gi) ?? [])
      .map((tag) => cleanText(tag))
      .join(" · ");
    const summary = cleanText(field(block, ["description", "summary"])).slice(0, 400);
    if (!title || !link) continue;
    entries.push({ title, link, date, context: `${categories} ${summary}`.trim() });
  }
  return entries;
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function fold(text: string): string {
  return stripAccents(text).toLowerCase();
}

/* All patterns below are matched on text with the accents removed. */

/** Words that only mean the election. Enough on their own, in the headline or the feed's summary. */
const STRONG =
  /\b(eleccion(es)?|comicios|(pre|post)?electoral(es)?|elector(es|ado)?|29[\s-]?n|urnas?)\b/;

/** Voting words. In a headline about a decree or a plenary they mean a vote in parliament, so they do not count there. */
const VOTE = /\b(vot(o|os|a|an|e|en|ar|aron|ara|aran|acion|aciones|antes?)|papeletas?)\b/;
const PARLIAMENT =
  /\b(decretos?|ley(es)?|pleno|mocion(es)?|presupuestos?|enmiendas?|convalida\w*|diputacion permanente|congreso|senado)\b/;

/** Other campaign and count vocabulary, headline only. */
const CAMPAIGN =
  /\b(las generales|(?<!\b(su|bajo|eludir) )escrutinio(?! (publico|judicial|parlamentario|de bruselas|de la ue))|recuento|campana|sondeos?|encuestas?|candidat[oa]s?|candidaturas?|investidura|escanos?|mayoria absoluta|jornada de reflexion|mitin(es)?|participacion (a las|hasta las|sube|baja|cae|crece|alcanza|se situa|es del|del \d)|cara a cara|debate (electoral|a (dos|tres|cuatro|cinco|seis|siete)))\b/;

/**
 * The candidates and parties on the desk, as written in a headline. Case matters:
 * "Podemos" the party, not "podemos". A candidate's name is enough; a party's is
 * not, because a court case or a town budget names one party too. Two parties in
 * one headline is the campaign.
 */
const CANDIDATES = /\b(Sanchez|Feijoo|Abascal|Colau)\b/;
const PARTIES = /\b(PSOE|PP|Vox|VOX|Frente Amplio|Podemos|Junts|ERC|Bildu|PNV|BNG)\b/g;

function namesTheContest(plain: string): boolean {
  if (CANDIDATES.test(plain)) return true;
  const parties = new Set((plain.match(PARTIES) ?? []).map((party) => party.toLowerCase()));
  return parties.size >= 2;
}

/** Violent-crime vocabulary. Such a headline is never shown, whatever else it mentions. */
const CRIME =
  /\b(crimen(es)?|asesin\w*|mato|matar|homicid\w*|navajazos?|apunal\w*|violacion(es)?|agresion sexual|cadaver(es)?|tiroteo)\b/;

/** The outlet filed the article under its own election section. */
const ELECTION_PATH = /\/elecciones[-/]/;

/**
 * Whether a feed item belongs on the Live page: its headline uses election
 * vocabulary, names a candidate or two parties, or the outlet filed it under its
 * election section.
 */
/** The stricter test behind `LiveItem.core`: the headline or the outlet's own section says "election". */
export function isCoreElectionItem(title: string, url = ""): boolean {
  const folded = fold(title);
  if (CRIME.test(folded)) return false;
  return STRONG.test(folded) || CAMPAIGN.test(folded) || ELECTION_PATH.test(url);
}

export function isElectionItem(title: string, context: string, url = ""): boolean {
  const plain = stripAccents(title);
  const folded = plain.toLowerCase();
  if (CRIME.test(folded)) return false;
  if (STRONG.test(folded) || CAMPAIGN.test(folded)) return true;
  if (VOTE.test(folded) && !PARLIAMENT.test(folded)) return true;
  if (ELECTION_PATH.test(url)) return true;
  if (namesTheContest(plain)) return true;
  return STRONG.test(fold(context));
}

function ownLink(link: string, domain: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== domain && !host.endsWith(`.${domain}`)) return null;
  url.protocol = "https:";
  url.hash = "";
  return url.href;
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** One outlet's entries, filtered to election items from the last two days, newest first. */
export function toItems(outlet: LiveOutlet, entries: RawEntry[], now: number): LiveItem[] {
  const seen = new Set<string>();
  const items: LiveItem[] = [];
  for (const entry of entries) {
    const at = Date.parse(entry.date);
    if (!Number.isFinite(at)) continue;
    if (at > now + FUTURE_SLACK_MS || now - at > MAX_AGE_MS) continue;
    const url = ownLink(entry.link, outlet.domain);
    if (!url) continue;
    if (!isElectionItem(entry.title, entry.context, url)) continue;
    const title =
      entry.title.length > 240 ? `${entry.title.slice(0, 237).trimEnd()}…` : entry.title;
    const key = url.split("?")[0];
    const titleKey = fold(title);
    if (seen.has(key) || seen.has(titleKey)) continue;
    seen.add(key);
    seen.add(titleKey);
    items.push({
      id: `${outlet.id}-${hash(key)}`,
      outlet: outlet.name,
      title,
      url,
      at,
      core: isCoreElectionItem(entry.title, url),
    });
  }
  items.sort((a, b) => b.at - a.at);
  return items.slice(0, PER_OUTLET);
}

/** All outlets together, newest first, capped. */
export function mergeItems(lists: LiveItem[][]): LiveItem[] {
  return lists
    .flat()
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
    .slice(0, TOTAL);
}
