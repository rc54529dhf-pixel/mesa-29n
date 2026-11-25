export type Lang = "en" | "es";
export type Bi = { en: string; es: string };

export const bi = (en: string, es: string): Bi => ({ en, es });

export type PartyId =
  | "pp"
  | "psoe"
  | "vox"
  | "fa"
  | "sumar"
  | "erc"
  | "junts"
  | "bildu"
  | "pnv"
  | "bng"
  | "cc"
  | "upn"
  | "podemos"
  | "salf"
  | "fronts"
  | "fv"
  | "aa"
  | "other";

export type Kind = "official-poll" | "media" | "model";

export const CONGRESS = 350;
export const MAJORITY = 176;
export const SENATE_DIRECT = 209;

/** Milestone instants, Europe/Madrid (CET, UTC+1). */
export const TIMES = {
  campaignEnd: Date.parse("2026-11-28T00:00:00+01:00"),
  electionDay: Date.parse("2026-11-29T00:00:00+01:00"),
  pollsOpen: Date.parse("2026-11-29T09:00:00+01:00"),
  peninsulaClose: Date.parse("2026-11-29T20:00:00+01:00"),
  canariesClose: Date.parse("2026-11-29T21:00:00+01:00"),
  chambers: Date.parse("2026-12-23T10:00:00+01:00"),
};

const SILENCE_START = Date.parse("2026-11-24T00:00:00+01:00");
const POSTAL_CAST_END = Date.parse("2026-11-26T00:00:00+01:00");

export function pollSilence(now: number): boolean {
  return now >= SILENCE_START && now < TIMES.peninsulaClose;
}

export type Phase =
  | "campaign"
  | "reflection"
  | "preelection"
  | "open"
  | "canaries"
  | "count";

export function phaseAt(now: number): Phase {
  if (now < TIMES.campaignEnd) return "campaign";
  if (now < TIMES.electionDay) return "reflection";
  if (now < TIMES.pollsOpen) return "preelection";
  if (now < TIMES.peninsulaClose) return "open";
  if (now < TIMES.canariesClose) return "canaries";
  return "count";
}

export function countdownTarget(phase: Phase): { at: number; label: Bi } | null {
  if (phase === "campaign") {
    return { at: TIMES.campaignEnd, label: bi("Campaign ends", "Fin de campaña") };
  }
  if (phase === "reflection" || phase === "preelection") {
    return { at: TIMES.pollsOpen, label: bi("Polls open", "Apertura") };
  }
  if (phase === "open") {
    return {
      at: TIMES.peninsulaClose,
      label: bi("Mainland polls close", "Cierran península"),
    };
  }
  if (phase === "canaries") {
    return {
      at: TIMES.canariesClose,
      label: bi("Canaries polls close", "Cierran Canarias"),
    };
  }
  return null;
}

export const PARTIES: Record<PartyId, { short: string; name: Bi; color: string }> = {
  pp: { short: "PP", name: bi("People's Party", "Partido Popular"), color: "var(--color-pp)" },
  psoe: {
    short: "PSOE",
    name: bi("Spanish Socialist Workers' Party", "Partido Socialista Obrero Español"),
    color: "var(--color-psoe)",
  },
  vox: { short: "Vox", name: bi("Vox", "Vox"), color: "var(--color-vox)" },
  fa: { short: "FA", name: bi("Frente Amplio", "Frente Amplio"), color: "var(--color-fa)" },
  sumar: {
    short: "Sumar",
    name: bi("Sumar (2023 list)", "Sumar (lista de 2023)"),
    color: "var(--color-sumar)",
  },
  erc: {
    short: "ERC",
    name: bi("Republican Left of Catalonia", "Esquerra Republicana de Catalunya"),
    color: "var(--color-erc)",
  },
  junts: { short: "Junts", name: bi("Together for Catalonia", "Junts per Catalunya"), color: "var(--color-junts)" },
  bildu: { short: "EH Bildu", name: bi("EH Bildu", "EH Bildu"), color: "var(--color-bildu)" },
  pnv: { short: "PNV", name: bi("Basque Nationalist Party", "Partido Nacionalista Vasco"), color: "var(--color-pnv)" },
  bng: { short: "BNG", name: bi("Galician Nationalist Bloc", "Bloque Nacionalista Galego"), color: "var(--color-bng)" },
  cc: { short: "CCa", name: bi("Canarian Coalition", "Coalición Canaria"), color: "var(--color-cc)" },
  upn: { short: "UPN", name: bi("Navarrese People's Union", "Unión del Pueblo Navarro"), color: "var(--color-upn)" },
  podemos: { short: "Podemos", name: bi("Podemos", "Podemos"), color: "var(--color-podemos)" },
  salf: { short: "SALF", name: bi("The Party Is Over", "Se Acabó La Fiesta"), color: "var(--color-salf)" },
  fronts: {
    short: "Fronts",
    name: bi("Fronts (EL PAÍS grouping)", "Frentes (grupo de EL PAÍS)"),
    color: "var(--color-fronts)",
  },
  fv: { short: "FV", name: bi("Front Valencià", "Front Valencià"), color: "var(--color-fv)" },
  aa: { short: "AA", name: bi("Adelante Andalucía", "Adelante Andalucía"), color: "var(--color-aa)" },
  other: { short: "Other", name: bi("Others", "Otros"), color: "var(--color-other)" },
};

export type SeatBlock = { party: PartyId; seats: number; votes: number; pct: number };

/** Official Congress result, 23 July 2023. Ministerio del Interior file. */
export const RESULT_2023: SeatBlock[] = [
  { party: "sumar", seats: 31, votes: 3044996, pct: 12.33 },
  { party: "erc", seats: 7, votes: 466020, pct: 1.89 },
  { party: "bildu", seats: 6, votes: 335129, pct: 1.36 },
  { party: "bng", seats: 1, votes: 153995, pct: 0.62 },
  { party: "psoe", seats: 121, votes: 7821718, pct: 31.68 },
  { party: "pnv", seats: 5, votes: 277289, pct: 1.12 },
  { party: "junts", seats: 7, votes: 395429, pct: 1.6 },
  { party: "cc", seats: 1, votes: 116363, pct: 0.47 },
  { party: "upn", seats: 1, votes: 52188, pct: 0.21 },
  { party: "pp", seats: 137, votes: 8160837, pct: 33.06 },
  { party: "vox", seats: 33, votes: 3057000, pct: 12.38 },
];

export const RESULT_2023_META = {
  turnoutPct: 66.59,
  census: 37469458,
  cast: 24952447,
  valid: 24688087,
  blank: 200673,
  spoilt: 264360,
  ppVox: 170,
  investitureYes: 179,
  investitureDate: bi("16 November 2023", "16 de noviembre de 2023"),
};

/** Left-to-right reading order. Not the chamber's physical seating. */
export const READ_2023: PartyId[] = [
  "sumar",
  "erc",
  "bildu",
  "bng",
  "psoe",
  "pnv",
  "junts",
  "cc",
  "upn",
  "pp",
  "vox",
];

/** Editorial blocs. Not a legal category and not how Interior reports a count. */
export type WingId = "left" | "center" | "right";

export const WING_ORDER: WingId[] = ["left", "center", "right"];

export const WINGS: Record<
  WingId,
  { label: Bi; blurb: Bi; color: string; parties: PartyId[] }
> = {
  left: {
    label: bi("Left", "Izquierda"),
    blurb: bi(
      "PSOE, the broad-left list (Sumar in 2023, Frente Amplio in 2026), Podemos, and the left regional lists: ERC, EH Bildu, BNG, Front Valencià, Adelante Andalucía. A poll that says “Fronts” is counted entirely here.",
      "PSOE, la lista de la izquierda amplia (Sumar en 2023, Frente Amplio en 2026), Podemos y las listas territoriales de izquierda: ERC, EH Bildu, BNG, Front Valencià, Adelante Andalucía. Un sondeo que dice «Frentes» cuenta entero aquí.",
    ),
    color: "var(--color-left)",
    parties: ["psoe", "sumar", "fa", "podemos", "erc", "bildu", "bng", "fv", "aa", "fronts"],
  },
  center: {
    label: bi("Center", "Centro"),
    blurb: bi(
      "The hinge, not a moderate statewide party. PNV, Junts and Coalición Canaria are centre-right at home. They sit here because either side may need them.",
      "El fiel de la balanza, no un partido moderado de ámbito estatal. PNV, Junts y Coalición Canaria son de centro-derecha en su territorio. Están aquí porque cualquiera de los dos lados puede necesitarlos.",
    ),
    color: "var(--color-center)",
    parties: ["pnv", "junts", "cc"],
  },
  right: {
    label: bi("Right", "Derecha"),
    blurb: bi(
      "PP, Vox, UPN and SALF. UPN usually votes with the PP. SALF is a right-wing populist list, not a centre party.",
      "PP, Vox, UPN y SALF. UPN suele votar con el PP. SALF es una lista populista de derecha, no un partido de centro.",
    ),
    color: "var(--color-right)",
    parties: ["pp", "vox", "upn", "salf"],
  },
};

export function resultByWing(): {
  id: WingId;
  seats: number;
  votes: number;
  pct: number;
  parties: PartyId[];
}[] {
  return WING_ORDER.map((id) => {
    const blocks = RESULT_2023.filter((b) => WINGS[id].parties.includes(b.party));
    const votes = blocks.reduce((sum, b) => sum + b.votes, 0);
    return {
      id,
      seats: blocks.reduce((sum, b) => sum + b.seats, 0),
      votes,
      pct: (votes / RESULT_2023_META.valid) * 100,
      parties: blocks.map((b) => b.party),
    };
  });
}

export type Source = {
  id: string;
  kind: "official" | "media" | "model";
  name: string;
  href: string;
  used: Bi;
};

export const SOURCES: Source[] = [
  {
    id: "interior-web",
    kind: "official",
    name: "Ministerio del Interior",
    href: "https://29neleccionesgenerales.es",
    used: bi(
      "Official election site for 29 November, launched by the ministry. Rules, calendar, how to vote.",
      "Web oficial de estas elecciones, abierta por el ministerio. Normas, calendario y cómo votar.",
    ),
  },
  {
    id: "infoelectoral",
    kind: "official",
    name: "Infoelectoral",
    href: "https://infoelectoral.interior.gob.es",
    used: bi(
      "Interior's results service. The provisional scrutiny is published here after the polls close. The 2023 file is the baseline on this desk.",
      "Servicio de resultados de Interior. El escrutinio provisional se publica aquí al cerrar los colegios. El fichero de 2023 es la base de esta mesa.",
    ),
  },
  {
    id: "interior",
    kind: "official",
    name: "interior.gob.es",
    href: "https://www.interior.gob.es",
    used: bi(
      "Ministry site. It describes the provisional-results feed accredited media use on election night.",
      "Web del ministerio. Describe el canal de resultados provisionales que usan los medios acreditados la noche electoral.",
    ),
  },
  {
    id: "boe",
    kind: "official",
    name: "Boletín Oficial del Estado",
    href: "https://www.boe.es",
    used: bi(
      "Real Decreto 806/2026, published 6 October 2026, dissolves the Cortes and calls the election. The Constitution and the electoral law (LOREG) are published here too.",
      "El Real Decreto 806/2026, publicado el 6 de octubre de 2026, disuelve las Cortes y convoca las elecciones. También están la Constitución y la LOREG.",
    ),
  },
  {
    id: "cis",
    kind: "official",
    name: "CIS",
    href: "https://www.cis.es",
    used: bi(
      "Centro de Investigaciones Sociológicas, the state pollster. Its pre-ban reading is the official poll on this desk, and it disagrees with the private polls.",
      "Centro de Investigaciones Sociológicas, el instituto público. Su lectura previa a la veda es el sondeo oficial de esta mesa, y no coincide con los privados.",
    ),
  },
  {
    id: "reuters",
    kind: "media",
    name: "Reuters",
    href: "https://www.reuters.com/world/spains-right-set-win-majority-despite-socialist-gains-polls-show-2026-11-23/",
    used: bi(
      "23 November roundup of the last polls that could be published in Spain: CIS, 40dB, GAD3, Ipsos, NC Report and IMOP.",
      "Resumen del 23 de noviembre de los últimos sondeos publicables en España: CIS, 40dB, GAD3, Ipsos, NC Report e IMOP.",
    ),
  },
  {
    id: "elpais",
    kind: "media",
    name: "EL PAÍS",
    href: "https://english.elpais.com/spain/2026-11-24/what-do-the-latest-polls-show-ahead-of-spains-general-election.html",
    used: bi(
      "Final polling average, 24 November, and the paper's table of late private polls.",
      "Media de sondeos final, 24 de noviembre, y la tabla del diario con los últimos sondeos privados.",
    ),
  },
  {
    id: "wiki",
    kind: "media",
    name: "Wikipedia compilation",
    href: "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Spanish_general_election",
    used: bi(
      "Secondary table of seat ranges. Used only where the shares match what EL PAÍS or Reuters printed.",
      "Tabla secundaria de horquillas de escaños. Solo cuando los porcentajes coinciden con lo que publicaron EL PAÍS o Reuters.",
    ),
  },
  {
    id: "votantonio",
    kind: "model",
    name: "VotAntonio",
    href: "https://votantonio.eu/en/spain/polls",
    used: bi(
      "Informal average of 109 polls, as of 23 November, with a seat estimate. Not a poll and not a count.",
      "Media informal de 109 sondeos, a 23 de noviembre, con estimación de escaños. Ni es un sondeo ni es un recuento.",
    ),
  },
  {
    id: "pollingforecast",
    kind: "model",
    name: "Polling Forecast",
    href: "https://www.pollingforecast.com/es",
    used: bi(
      "Model updated 25 November 08:36 CET, during the Spanish poll ban, from polls no later than 23 November.",
      "Modelo actualizado el 25 de noviembre a las 08:36 CET, durante la veda española, con sondeos no posteriores al 23.",
    ),
  },
  {
    id: "lemillenaire",
    kind: "model",
    name: "Le Millénaire",
    href: "https://forecast.lemillenaire.org/en/spain/general-election/2026/",
    used: bi(
      "20,000-simulation forecast dated 22 November. Intervals are simulation ranges, not a poll's margin of error.",
      "Pronóstico de 20.000 simulaciones del 22 de noviembre. Los intervalos son de la simulación, no el margen de un sondeo.",
    ),
  },
];

export type Poll = {
  id: string;
  kind: Kind;
  pollster: string;
  outlet: string;
  when: Bi;
  sample: Bi | null;
  shares: { party: PartyId; pct: number }[];
  seats: { party: PartyId; low: number; high: number }[];
  extra: Bi;
  sourceId: string;
};

export const POLLS: Poll[] = [
  {
    id: "cis",
    kind: "official-poll",
    pollster: "CIS",
    outlet: "Centro de Investigaciones Sociológicas",
    when: bi("Published by 23 Nov 2026", "Publicado a 23 nov 2026"),
    sample: bi("8,034 interviews", "8.034 entrevistas"),
    shares: [
      { party: "psoe", pct: 34.4 },
      { party: "pp", pct: 24.9 },
      { party: "vox", pct: 15.6 },
    ],
    seats: [],
    extra: bi(
      "Official state pollster. Reuters called it the major outlier: PSOE well ahead, the reverse of the private polls. No seat projection was printed in that report. Do not turn these shares into seats. Congress is not a national proportional system.",
      "Instituto público. Reuters lo señaló como el gran atípico: el PSOE muy por delante, al revés que los sondeos privados. Ese despacho no traía escaños. No conviertas estos porcentajes en diputados. El Congreso no es proporcional nacional.",
    ),
    sourceId: "reuters",
  },
  {
    id: "40db",
    kind: "media",
    pollster: "40dB",
    outlet: "EL PAÍS",
    when: bi("23 Nov 2026", "23 nov 2026"),
    sample: bi("7,500 interviews", "7.500 entrevistas"),
    shares: [
      { party: "pp", pct: 31.8 },
      { party: "psoe", pct: 30.9 },
      { party: "vox", pct: 17.3 },
    ],
    seats: [
      { party: "pp", low: 127, high: 136 },
      { party: "psoe", low: 116, high: 127 },
      { party: "vox", low: 51, high: 61 },
    ],
    extra: bi(
      "Daily tracking poll. Even the bottom of its PP+Vox range (127+51) is 178, two seats over a majority. The top of the range is 197.",
      "Sondeo diario. Incluso el suelo de PP+Vox (127+51) suma 178, dos por encima de la mayoría. El techo de la horquilla es 197.",
    ),
    sourceId: "reuters",
  },
  {
    id: "sigma",
    kind: "media",
    pollster: "Sigma Dos",
    outlet: "El Mundo",
    when: bi("16–23 Nov 2026", "16–23 nov 2026"),
    sample: bi("5,252 interviews", "5.252 entrevistas"),
    shares: [
      { party: "pp", pct: 31.9 },
      { party: "psoe", pct: 28.6 },
      { party: "vox", pct: 17.8 },
    ],
    seats: [
      { party: "pp", low: 124, high: 130 },
      { party: "psoe", low: 114, high: 120 },
      { party: "vox", low: 58, high: 63 },
    ],
    extra: bi(
      "Shares from the EL PAÍS table (grade A on that paper's scale). Seat range from the Wikipedia compilation of the same release. Estimated turnout in that compilation: 76.9%.",
      "Porcentajes de la tabla de EL PAÍS (nota A en su escala). Horquilla de escaños de la compilación de Wikipedia de la misma entrega. Participación estimada en esa ficha: 76,9%.",
    ),
    sourceId: "elpais",
  },
  {
    id: "gad3",
    kind: "media",
    pollster: "GAD3",
    outlet: "ABC",
    when: bi("22 Nov 2026", "22 nov 2026"),
    sample: bi("1,501 interviews", "1.501 entrevistas"),
    shares: [],
    seats: [
      { party: "pp", low: 131, high: 131 },
      { party: "psoe", low: 110, high: 110 },
      { party: "vox", low: 63, high: 63 },
    ],
    extra: bi(
      "Reuters printed seats, not shares: PP 131, PSOE 110, Vox 63. Combined PP+Vox: 194.",
      "Reuters publicó escaños, no porcentajes: PP 131, PSOE 110, Vox 63. PP+Vox: 194.",
    ),
    sourceId: "reuters",
  },
  {
    id: "ipsos",
    kind: "media",
    pollster: "Ipsos",
    outlet: "La Vanguardia",
    when: bi("22 Nov 2026", "22 nov 2026"),
    sample: bi("1,999 interviews", "1.999 entrevistas"),
    shares: [
      { party: "pp", pct: 30.3 },
      { party: "psoe", pct: 29.8 },
    ],
    seats: [
      { party: "pp", low: 127, high: 127 },
      { party: "psoe", low: 119, high: 119 },
      { party: "vox", low: 63, high: 63 },
    ],
    extra: bi(
      "Reuters gave PP 30.3% and 127 seats, PSOE 29.8% and 119, Vox 63 seats. It did not print Vox's share. PP+Vox in this projection: 190.",
      "Reuters dio al PP 30,3% y 127 escaños, al PSOE 29,8% y 119, y a Vox 63 escaños. No publicó el porcentaje de Vox. PP+Vox en esta proyección: 190.",
    ),
    sourceId: "reuters",
  },
  {
    id: "nc",
    kind: "media",
    pollster: "NC Report",
    outlet: "La Razón",
    when: bi("Week of 23 Nov 2026", "Semana del 23 nov 2026"),
    sample: bi("1,000 interviews", "1.000 entrevistas"),
    shares: [{ party: "psoe", pct: 27.2 }],
    seats: [
      { party: "psoe", low: 108, high: 111 },
      { party: "pp", low: 130, high: 133 },
      { party: "vox", low: 64, high: 66 },
    ],
    extra: bi(
      "Reuters: PSOE 27.2%, up from 26.1% a week earlier. PP+Vox at least 194. Shares for PP and Vox were not in that dispatch.",
      "Reuters: PSOE 27,2%, desde el 26,1% de la semana anterior. PP+Vox, al menos 194. El despacho no traía los porcentajes de PP y Vox.",
    ),
    sourceId: "reuters",
  },
  {
    id: "imop",
    kind: "media",
    pollster: "IMOP",
    outlet: "El Confidencial",
    when: bi("23 Nov 2026", "23 nov 2026"),
    sample: bi("1,500 interviews", "1.500 entrevistas"),
    shares: [],
    seats: [{ party: "psoe", low: 110, high: 110 }],
    extra: bi(
      "Reuters: PP and Vox together on 195 seats, PSOE on 110. The split between PP and Vox was not printed.",
      "Reuters: PP y Vox juntos en 195 escaños, PSOE en 110. No se publicó el reparto entre PP y Vox.",
    ),
    sourceId: "reuters",
  },
  {
    id: "atlas",
    kind: "media",
    pollster: "AtlasIntel",
    outlet: "AtlasIntel",
    when: bi("20–23 Nov 2026", "20–23 nov 2026"),
    sample: bi("1,045 interviews", "1.045 entrevistas"),
    shares: [
      { party: "psoe", pct: 29.8 },
      { party: "pp", pct: 29.1 },
      { party: "vox", pct: 17.8 },
    ],
    seats: [
      { party: "pp", low: 121, high: 121 },
      { party: "psoe", low: 120, high: 120 },
      { party: "vox", low: 64, high: 64 },
    ],
    extra: bi(
      "The widely cited final poll with PSOE ahead on votes, by 0.7 points. Seats still had PP one ahead (121 to 120) and PP+Vox on 185. Shares as reported by Polling Forecast; sample and seats from the Wikipedia compilation.",
      "El sondeo final más citado con el PSOE por delante en voto, por 0,7 puntos. En escaños el PP seguía uno por delante (121 a 120) y PP+Vox sumaba 185. Porcentajes según Polling Forecast; muestra y escaños, de la compilación de Wikipedia.",
    ),
    sourceId: "wiki",
  },
  {
    id: "sociometrica",
    kind: "media",
    pollster: "Sociométrica",
    outlet: "El Español",
    when: bi("23 Nov 2026", "23 nov 2026"),
    sample: bi("7,781 interviews", "7.781 entrevistas"),
    shares: [
      { party: "pp", pct: 32.4 },
      { party: "psoe", pct: 29.0 },
      { party: "vox", pct: 18.1 },
      { party: "fronts", pct: 6.1 },
      { party: "podemos", pct: 1.0 },
      { party: "salf", pct: 2.1 },
      { party: "aa", pct: 1.7 },
    ],
    seats: [],
    extra: bi(
      "EL PAÍS table, grade A. “Fronts” is that paper’s grouping: Frente Amplio plus lists it counts with Podemos in Valencia, Aragon and the Canaries. It is not a pure Frente Amplio number.",
      "Tabla de EL PAÍS, nota A. «Frentes» es el grupo del diario: Frente Amplio más listas que cuenta con Podemos en Valencia, Aragón y Canarias. No es la cifra solo de Frente Amplio.",
    ),
    sourceId: "elpais",
  },
  {
    id: "em",
    kind: "media",
    pollster: "EM-Analytics",
    outlet: "Electomanía",
    when: bi("23 Nov 2026", "23 nov 2026"),
    sample: bi("9,456 interviews", "9.456 entrevistas"),
    shares: [
      { party: "pp", pct: 31.5 },
      { party: "psoe", pct: 28.9 },
      { party: "vox", pct: 17.9 },
      { party: "fronts", pct: 7.7 },
      { party: "podemos", pct: 0.9 },
      { party: "salf", pct: 2.2 },
      { party: "aa", pct: 1.7 },
    ],
    seats: [],
    extra: bi(
      "EL PAÍS table, grade B. Electomanía is a private tracker, not an official body. Same “Fronts” grouping as the rest of that table.",
      "Tabla de EL PAÍS, nota B. Electomanía es un agregador privado, no un organismo oficial. El mismo grupo «Frentes» que el resto de esa tabla.",
    ),
    sourceId: "elpais",
  },
  {
    id: "elpais-avg",
    kind: "model",
    pollster: "EL PAÍS average",
    outlet: "EL PAÍS",
    when: bi("Final update, 24 Nov 2026", "Cierre, 24 nov 2026"),
    sample: null,
    shares: [
      { party: "pp", pct: 31.5 },
      { party: "psoe", pct: 29.0 },
      { party: "vox", pct: 17.9 },
      { party: "fronts", pct: 6.8 },
      { party: "other", pct: 10.2 },
    ],
    seats: [],
    extra: bi(
      "The paper’s last average before the ban, not a single poll. PP ahead of PSOE by about 2.5 points. “Others” is everyone outside PP, PSOE, Vox and the Fronts grouping.",
      "Última media del diario antes de la veda, no un sondeo suelto. El PP aventaja al PSOE en unos 2,5 puntos. «Otros» es todo lo que no es PP, PSOE, Vox ni el grupo de frentes.",
    ),
    sourceId: "elpais",
  },
  {
    id: "votantonio",
    kind: "model",
    pollster: "VotAntonio average",
    outlet: "VotAntonio",
    when: bi("23 Nov 2026", "23 nov 2026"),
    sample: bi("109 polls, last 30 days", "109 sondeos, últimos 30 días"),
    shares: [
      { party: "pp", pct: 31.2 },
      { party: "psoe", pct: 28.6 },
      { party: "vox", pct: 18.3 },
      { party: "fa", pct: 6.1 },
      { party: "erc", pct: 2.6 },
      { party: "salf", pct: 2.0 },
      { party: "bildu", pct: 1.5 },
      { party: "fv", pct: 1.4 },
      { party: "junts", pct: 1.3 },
      { party: "podemos", pct: 1.3 },
      { party: "bng", pct: 0.9 },
      { party: "pnv", pct: 0.9 },
      { party: "cc", pct: 0.4 },
    ],
    seats: [
      { party: "pp", low: 131, high: 131 },
      { party: "psoe", low: 114, high: 114 },
      { party: "vox", low: 62, high: 62 },
      { party: "erc", low: 10, high: 10 },
      { party: "fa", low: 9, high: 9 },
      { party: "bildu", low: 7, high: 7 },
      { party: "junts", low: 5, high: 5 },
      { party: "fv", low: 4, high: 4 },
      { party: "pnv", low: 4, high: 4 },
      { party: "bng", low: 2, high: 2 },
      { party: "cc", low: 1, high: 1 },
    ],
    extra: bi(
      "Informal model. Regional parties are shown as a share of the national vote. The seat rows copied here add up to 349; one seat was not in the published rows we used. PP+Vox in this estimate: 193.",
      "Modelo informal. Los partidos territoriales salen como porcentaje del voto nacional. Los escaños copiados aquí suman 349; un escaño no estaba en las filas publicadas que usamos. PP+Vox en esta estimación: 193.",
    ),
    sourceId: "votantonio",
  },
  {
    id: "pf",
    kind: "model",
    pollster: "Polling Forecast",
    outlet: "Polling Forecast",
    when: bi("Updated 25 Nov 2026, 08:36 CET", "Actualizado 25 nov 2026, 08:36 CET"),
    sample: null,
    shares: [
      { party: "pp", pct: 30.9 },
      { party: "psoe", pct: 28.9 },
      { party: "vox", pct: 18.2 },
      { party: "fa", pct: 6.3 },
    ],
    seats: [
      { party: "pp", low: 131, high: 131 },
      { party: "psoe", low: 119, high: 119 },
      { party: "vox", low: 63, high: 63 },
    ],
    extra: bi(
      "Updated during the Spanish ban, using polls no newer than 23 November. Their point forecast is PP+Vox 194, a majority in 96% of their simulations. They still say “Sumar” in places; the 2026 list is Frente Amplio. The 6.3% is their figure for that space.",
      "Actualizado durante la veda española, con sondeos no posteriores al 23 de noviembre. Su cifra puntual es PP+Vox 194, mayoría en el 96% de sus simulaciones. Aún dicen «Sumar» en algunos sitios; la lista de 2026 es Frente Amplio. El 6,3% es su cifra para ese espacio.",
    ),
    sourceId: "pollingforecast",
  },
  {
    id: "millenaire",
    kind: "model",
    pollster: "Le Millénaire",
    outlet: "Le Millénaire",
    when: bi("Run of 22 Nov 2026", "Pasada del 22 nov 2026"),
    sample: bi("20,000 simulations", "20.000 simulaciones"),
    shares: [],
    seats: [
      { party: "pp", low: 95, high: 158 },
      { party: "psoe", low: 81, high: 155 },
      { party: "vox", low: 43, high: 87 },
    ],
    extra: bi(
      "These seat bars are 90% simulation intervals, not a poll range. Medians: PP 125, PSOE 115, Vox 64. PP+Vox reach 176 in 75 of 100 simulations. Chance of leading a government after the election, in their model: Feijóo 78%, Sánchez 22%, Abascal under 1%.",
      "Estas barras son intervalos del 90% de la simulación, no la horquilla de un sondeo. Medianas: PP 125, PSOE 115, Vox 64. PP+Vox llega a 176 en 75 de cada 100 simulaciones. Probabilidad de encabezar el Gobierno tras la elección, en su modelo: Feijóo 78%, Sánchez 22%, Abascal menos del 1%.",
    ),
    sourceId: "lemillenaire",
  },
];

export const CANDIDATES: { party: PartyId; name: string; role: Bi }[] = [
  {
    party: "pp",
    name: "Alberto Núñez Feijóo",
    role: bi("PP candidate for prime minister", "Candidato del PP a la presidencia"),
  },
  {
    party: "psoe",
    name: "Pedro Sánchez",
    role: bi("Prime minister and PSOE candidate", "Presidente del Gobierno y candidato del PSOE"),
  },
  {
    party: "vox",
    name: "Santiago Abascal",
    role: bi("Vox candidate", "Candidato de Vox"),
  },
  {
    party: "fa",
    name: "Ada Colau",
    role: bi(
      "Frente Amplio candidate. Yolanda Díaz led Sumar in 2023 and is not heading this list.",
      "Candidata del Frente Amplio. Yolanda Díaz encabezó Sumar en 2023 y no encabeza esta lista.",
    ),
  },
];

export const PROVINCES: { name: Bi; seats: number; note?: Bi }[] = [
  { name: bi("Madrid", "Madrid"), seats: 38, note: bi("One more than in 2023", "Uno más que en 2023") },
  { name: bi("Barcelona", "Barcelona"), seats: 32 },
  { name: bi("Valencia", "Valencia"), seats: 16 },
  { name: bi("Seville", "Sevilla"), seats: 12 },
  { name: bi("Alicante", "Alicante"), seats: 12 },
  { name: bi("Málaga", "Málaga"), seats: 11 },
  { name: bi("Murcia", "Murcia"), seats: 10 },
  {
    name: bi("Cádiz", "Cádiz"),
    seats: 8,
    note: bi("One fewer than in 2023", "Uno menos que en 2023"),
  },
];

export const RULES: { title: Bi; body: Bi }[] = [
  {
    title: bi("Two ballots", "Dos papeletas"),
    body: bi(
      "Congress: one closed list. Senate: you mark names, up to three in a typical province. Islands and Ceuta and Melilla elect fewer senators, so the maximum on that paper is lower. The ballot says how many.",
      "Congreso: una lista cerrada. Senado: se marcan nombres, hasta tres en una provincia típica. Las islas y Ceuta y Melilla eligen menos senadores, así que el máximo de esa papeleta es menor. La papeleta indica cuántos.",
    ),
  },
  {
    title: bi("Bring photo ID", "Lleva un documento con foto"),
    body: bi(
      "DNI, passport, or driving licence. Polls open 09:00 to 20:00, without a break. In the Canaries, 20:00 local is 21:00 in Madrid, so the national count is incomplete until then.",
      "DNI, pasaporte o permiso de conducir. Los colegios abren de 09:00 a 20:00, sin interrupción. En Canarias, las 20:00 locales son las 21:00 en Madrid, así que el recuento nacional queda incompleto hasta esa hora.",
    ),
  },
  {
    title: bi("Who wins the Congress", "Quién gana el Congreso"),
    body: bi(
      "350 seats, D'Hondt inside each of 52 constituencies, with a 3% threshold inside the constituency, not a national 3%. An absolute majority is 176. The first investiture vote needs 176 yeses. If it fails, a second vote 48 hours later needs more yeses than noes.",
      "350 escaños, D'Hondt en cada una de las 52 circunscripciones, con una barrera del 3% dentro de la circunscripción, no un 3% nacional. La mayoría absoluta son 176. La primera votación de investidura necesita 176 síes. Si falla, una segunda 48 horas después necesita más síes que noes.",
    ),
  },
  {
    title: bi("What is official on the night", "Qué es oficial esa noche"),
    body: bi(
      "After 20:00 the ministry publishes a provisional count. It is not the proclamation. Provincial electoral boards finish the official scrutiny afterwards. The new Congress and Senate meet on 23 December at 10:00.",
      "A partir de las 20:00 el ministerio publica un escrutinio provisional. No es la proclamación. Las juntas electorales provinciales cierran el escrutinio oficial después. El Congreso y el Senado nuevos se reúnen el 23 de diciembre a las 10:00.",
    ),
  },
];

export const CALENDAR: { id: string; when: Bi; what: Bi }[] = [
  {
    id: "announce",
    when: bi("5 Oct 2026", "5 oct 2026"),
    what: bi("Sánchez announces the dissolution", "Sánchez anuncia la disolución"),
  },
  {
    id: "boe",
    when: bi("6 Oct 2026", "6 oct 2026"),
    what: bi("RD 806/2026 in the BOE. Cortes dissolved.", "RD 806/2026 en el BOE. Cortes disueltas."),
  },
  {
    id: "campaign",
    when: bi("13–27 Nov", "13–27 nov"),
    what: bi("Official campaign, ending Friday at midnight", "Campaña oficial, acaba el viernes a medianoche"),
  },
  {
    id: "postal-ask",
    when: bi("19 Nov", "19 nov"),
    what: bi("Last day to request a postal vote", "Último día para pedir el voto por correo"),
  },
  {
    id: "silence",
    when: bi("24–28 Nov", "24–28 nov"),
    what: bi(
      "Poll-publication ban in Spain (LOREG art. 69.7). Five days before the vote.",
      "Veda de publicación de sondeos en España (LOREG art. 69.7). Cinco días antes de la votación.",
    ),
  },
  {
    id: "postal-cast",
    when: bi("25 Nov", "25 nov"),
    what: bi(
      "Electoral guides list this as the last day to hand in a postal ballot. Confirm on the Interior site if it still applies to you.",
      "Las guías del calendario lo marcan como último día para entregar el voto por correo. Confírmalo en la web de Interior si aún te afecta.",
    ),
  },
  {
    id: "reflection",
    when: bi("28 Nov", "28 nov"),
    what: bi("Reflection day. No campaigning.", "Jornada de reflexión. Sin campaña."),
  },
  {
    id: "vote",
    when: bi("29 Nov, 09:00–20:00", "29 nov, 09:00–20:00"),
    what: bi("Election day. Congress and Senate.", "Jornada electoral. Congreso y Senado."),
  },
  {
    id: "chambers",
    when: bi("23 Dec, 10:00", "23 dic, 10:00"),
    what: bi("New chambers sit", "Se constituyen las nuevas Cámaras"),
  },
];

export function calendarTone(id: string, now: number): "past" | "now" | "next" {
  switch (id) {
    case "announce":
    case "boe":
    case "postal-ask":
      return "past";
    case "campaign":
      return now < TIMES.campaignEnd ? "now" : "past";
    case "silence":
      if (now < SILENCE_START) return "next";
      if (now < TIMES.peninsulaClose) return "now";
      return "past";
    case "postal-cast":
      if (now < Date.parse("2026-11-25T00:00:00+01:00")) return "next";
      if (now < POSTAL_CAST_END) return "now";
      return "past";
    case "reflection":
      if (now < TIMES.campaignEnd) return "next";
      if (now < TIMES.electionDay) return "now";
      return "past";
    case "vote":
      if (now < TIMES.electionDay) return "next";
      if (now < TIMES.canariesClose) return "now";
      return "past";
    case "chambers":
      return now < TIMES.chambers ? "next" : "past";
    default:
      return "next";
  }
}

export function sourceById(id: string): Source {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`missing source ${id}`);
  return found;
}

export function formatInt(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-GB").format(n);
}

export function formatPct(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
}

export function seatLabel(low: number, high: number): string {
  return low === high ? String(low) : `${low}–${high}`;
}

export type WingSlice = {
  pct: number | null;
  low: number | null;
  high: number | null;
  parties: PartyId[];
};

/** Sum only parties that release actually printed. A blank wing means “not published”, not zero. */
export function slicesOf(poll: Poll): Record<WingId, WingSlice> {
  const out = {} as Record<WingId, WingSlice>;
  for (const id of WING_ORDER) {
    const allowed = new Set(WINGS[id].parties);
    const shares = poll.shares.filter((s) => allowed.has(s.party));
    const seats = poll.seats.filter((s) => allowed.has(s.party));
    const parties = [...new Set([...shares.map((s) => s.party), ...seats.map((s) => s.party)])];
    out[id] = {
      pct: shares.length ? shares.reduce((sum, s) => sum + s.pct, 0) : null,
      low: seats.length ? seats.reduce((sum, s) => sum + s.low, 0) : null,
      high: seats.length ? seats.reduce((sum, s) => sum + s.high, 0) : null,
      parties,
    };
  }
  return out;
}

export function otherShare(poll: Poll): number {
  return poll.shares.filter((s) => s.party === "other").reduce((sum, s) => sum + s.pct, 0);
}
