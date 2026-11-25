import { bi, type Bi } from "./election";

/**
 * Official items pinned above the media headlines on the Live page. Added by
 * hand, and only from an official source: the ministry, the electoral board,
 * the BOE. Every fact here is already stated elsewhere on the desk.
 */
export type PinnedItem = {
  id: string;
  title: Bi;
  text: Bi;
  link: { label: Bi; href: string };
};

export const LIVE_PINNED: PinnedItem[] = [
  {
    id: "results",
    title: bi("Results on election night", "Resultados en la noche electoral"),
    text: bi(
      "After 20:00 on Sunday the ministry publishes the provisional count on Infoelectoral. It is not the proclamation.",
      "A partir de las 20:00 del domingo el ministerio publica el escrutinio provisional en Infoelectoral. No es la proclamación.",
    ),
    link: {
      label: bi("Infoelectoral", "Infoelectoral"),
      href: "https://infoelectoral.interior.gob.es",
    },
  },
  {
    id: "how-to-vote",
    title: bi("How to vote", "Cómo votar"),
    text: bi(
      "Stations open 09:00–20:00 on Sunday 29 November. Bring photo ID.",
      "Colegios de 09:00 a 20:00 el domingo 29 de noviembre. Lleva un documento con foto.",
    ),
    link: {
      label: bi("Official how-to-vote site", "Web oficial para votar"),
      href: "https://29neleccionesgenerales.es",
    },
  },
];
