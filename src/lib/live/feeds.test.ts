import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LIVE_OUTLETS,
  cleanText,
  decodeFeed,
  isElectionItem,
  mergeItems,
  parseFeed,
  toItems,
} from "./feeds.ts";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const elmundo = LIVE_OUTLETS.find((outlet) => outlet.id === "elmundo")!;
const elpais = LIVE_OUTLETS.find((outlet) => outlet.id === "elpais")!;

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>Espa&ntilde;a // elmundo</title><link>https://www.elmundo.es/espana.html</link>
<item>
  <title><![CDATA[La campaña entra en su recta final con el voto por correo cerrado]]></title>
  <link>https://www.elmundo.es/espana/2026/11/25/abc123.html?cid=rss</link>
  <guid isPermaLink="true">https://www.elmundo.es/espana/2026/11/25/abc123.html</guid>
  <description><![CDATA[<p>Texto del <b>artículo</b> que no se muestra.</p>]]></description>
  <category>España</category>
  <pubDate>Wed, 25 Nov 2026 12:40:00 +0100</pubDate>
</item>
<item>
  <title>El Supremo cita a declarar a un exministro</title>
  <link>https://www.elmundo.es/espana/2026/11/25/def456.html</link>
  <description>Su participación en la trama, bajo la lupa.</description>
  <pubDate>Wed, 25 Nov 2026 12:30:00 +0100</pubDate>
</item>
<item>
  <title>Un titular sin fecha sobre las elecciones</title>
  <link>https://www.elmundo.es/espana/2026/11/25/nodate.html</link>
</item>
<item>
  <title>Elecciones: titular que enlaza a otro sitio</title>
  <link>https://example.com/phish</link>
  <pubDate>Wed, 25 Nov 2026 12:20:00 +0100</pubDate>
</item>
<item>
  <title>Elecciones generales: balance de hace una semana</title>
  <link>https://www.elmundo.es/espana/2026/11/18/old.html</link>
  <pubDate>Wed, 18 Nov 2026 09:00:00 +0100</pubDate>
</item>
<item>
  <title>&quot;No habr&aacute; sorpresas&quot;: la Junta Electoral responde &amp; avisa</title>
  <link>https://www.elmundo.es/espana/2026/11/25/jec.html</link>
  <pubDate>Wed, 25 Nov 2026 11:05:00 +0100</pubDate>
</item>
<item>
  <title>La campaña entra en su recta final con el voto por correo cerrado</title>
  <link>https://www.elmundo.es/espana/2026/11/25/abc123.html?cid=otro</link>
  <pubDate>Wed, 25 Nov 2026 12:41:00 +0100</pubDate>
</item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>EL PAÍS</title>
<entry>
  <title type="html">Los colegios abrir&amp;aacute;n a las 9.00 el 29-N</title>
  <link rel="enclosure" href="https://imagenes.elpais.com/foto.jpg"/>
  <link rel="alternate" type="text/html" href="https://elpais.com/espana/2026-11-25/colegios.html"/>
  <id>urn:uuid:1</id>
  <updated>2026-11-25T11:30:00Z</updated>
  <summary type="html">&lt;p&gt;Resumen&lt;/p&gt;</summary>
</entry>
<entry>
  <title>Sin enlace</title>
  <updated>2026-11-25T11:00:00Z</updated>
</entry>
</feed>`;

describe("cleanText", () => {
  it("unwraps CDATA, strips markup and decodes entities", () => {
    assert.equal(cleanText("<![CDATA[<p>Hola <b>mundo</b></p>]]>"), "Hola mundo");
    assert.equal(cleanText("&quot;S&iacute;&quot; &amp; no &#191;eh&#x3f;"), '"Sí" & no ¿eh?');
    assert.equal(cleanText("abrir&amp;aacute;n"), "abrirán");
    assert.equal(cleanText("  dos\n  líneas "), "dos líneas");
  });
});

describe("decodeFeed", () => {
  it("honours the charset the feed declares", () => {
    const head = '<?xml version="1.0" encoding="iso-8859-15"?><t>Espa';
    const bytes = new Uint8Array([
      ...Buffer.from(head, "latin1"),
      0xf1,
      ...Buffer.from("a</t>", "latin1"),
    ]);
    assert.match(decodeFeed(bytes, "text/xml"), /España/);
  });
  it("falls back to UTF-8", () => {
    const bytes = new TextEncoder().encode("<rss><t>España</t></rss>");
    assert.match(decodeFeed(bytes, null), /España/);
    assert.match(decodeFeed(bytes, "text/xml; charset=no-such-charset"), /España/);
  });
});

describe("isElectionItem", () => {
  it("keeps election vocabulary, with or without accents", () => {
    for (const title of [
      "Arranca la jornada de reflexión",
      "Así será el ESCRUTINIO del domingo",
      "Escrutinio al 50%: empate técnico",
      "Récord de voto por correo",
      "El 29N, en cinco claves",
      "La participación a las 14.00 es del 40,5%",
      "Los líderes cierran campaña en Madrid",
      "Los comicios del domingo, en cifras",
    ]) {
      assert.equal(isElectionItem(title, ""), true, title);
    }
  });
  it("keeps headlines that name a candidate or a party", () => {
    for (const title of [
      "Sánchez intenta asustar a las mujeres con una pérdida de derechos",
      "Feijóo promete bajar impuestos",
      "El PP acude al Parador de Teruel",
      "El Frente Amplio presenta su programa",
    ]) {
      assert.equal(isElectionItem(title, ""), true, title);
    }
  });
  it("leaves ordinary news out", () => {
    for (const title of [
      "El Supremo cita a declarar a un exministro",
      "Su participación en la trama, bajo la lupa",
      "El Gobierno aprueba el decreto de vivienda",
      "Un devoto de la tortilla abre restaurante",
      "El Congreso se prepara para votar los últimos cinco decretos del Gobierno",
      "Un directivo avisó a Bruselas de una triquiñuela para eludir su escrutinio",
      "Los vecinos: no podemos seguir así",
      "Ayuso ultima una subida de hasta 400 euros para los profesores",
    ]) {
      assert.equal(isElectionItem(title, ""), false, title);
    }
  });
  it("trusts the outlet's own election section and strong words in the summary", () => {
    assert.equal(
      isElectionItem(
        "Del Constitucional a las oposiciones a jueces",
        "",
        "https://elpais.com/espana/elecciones-generales/2026-11-25/x.html",
      ),
      true,
    );
    assert.equal(isElectionItem("Cinco claves del domingo", "Elecciones Generales · España"), true);
    assert.equal(
      isElectionItem("Cinco claves del domingo", "Su voto en el pleno fue decisivo"),
      false,
    );
  });
});

describe("parseFeed and toItems", () => {
  it("reads RSS, keeps recent election items on the outlet's own domain, without duplicates", () => {
    const items = toItems(elmundo, parseFeed(RSS), NOW);
    assert.deepEqual(
      items.map((item) => item.title),
      [
        "La campaña entra en su recta final con el voto por correo cerrado",
        '"No habrá sorpresas": la Junta Electoral responde & avisa',
      ],
    );
    assert.equal(items[0].outlet, "El Mundo");
    assert.ok(items[0].url.startsWith("https://www.elmundo.es/espana/2026/11/25/abc123.html"));
    assert.ok(items[0].at > items[1].at);
  });
  it("reads Atom and picks the article link, not the enclosure", () => {
    const items = toItems(elpais, parseFeed(ATOM), NOW);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Los colegios abrirán a las 9.00 el 29-N");
    assert.equal(items[0].url, "https://elpais.com/espana/2026-11-25/colegios.html");
  });
  it("returns nothing for something that is not a feed", () => {
    assert.deepEqual(parseFeed("<html><body>Access denied</body></html>"), []);
  });
});

describe("mergeItems", () => {
  it("orders all outlets together, newest first", () => {
    const merged = mergeItems([
      toItems(elmundo, parseFeed(RSS), NOW),
      toItems(elpais, parseFeed(ATOM), NOW),
    ]);
    assert.deepEqual(
      merged.map((item) => item.outlet),
      ["El Mundo", "EL PAÍS", "El Mundo"],
    );
  });
});
