// functions/api/cache.ts
var MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
var MAX_ENTRIES = 40;
var memoryStore = new Map;
function prune() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now - entry.at > MEMORY_TTL_MS)
      memoryStore.delete(key);
  }
  while (memoryStore.size > MAX_ENTRIES) {
    const oldest = memoryStore.keys().next();
    if (oldest.done)
      break;
    memoryStore.delete(oldest.value);
  }
}
var memoryCache = {
  async match(request) {
    const entry = memoryStore.get(request.url);
    if (!entry)
      return;
    if (Date.now() - entry.at > MEMORY_TTL_MS) {
      memoryStore.delete(request.url);
      return;
    }
    return new Response(entry.body.slice(0), {
      status: entry.status,
      headers: entry.headers
    });
  },
  async put(request, response) {
    const body = await response.arrayBuffer();
    memoryStore.set(request.url, {
      at: Date.now(),
      status: response.status,
      headers: [...response.headers.entries()],
      body
    });
    prune();
  }
};
var PROBE_URL = "https://hander-cache-probe.invalid/";
async function detectEdgeCache() {
  try {
    const cache = caches.default;
    if (!cache)
      return memoryCache;
    await cache.match(new Request(PROBE_URL));
    return cache;
  } catch {
    return memoryCache;
  }
}
var resolvedCache;
function edgeCache() {
  resolvedCache ??= detectEdgeCache();
  return resolvedCache;
}

// functions/api/event-image.ts
var CACHE_TTL_SECONDS = 60 * 60 * 24;
var FETCH_TIMEOUT_MS = 8000;
var MAX_HTML_BYTES = 600000;
var ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
var BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders }
  });
}
function normalizeImageUrl(value) {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    let raw = candidate;
    if (candidate && typeof candidate === "object") {
      const record = candidate;
      raw = record.url ?? record.contentUrl ?? record["@id"];
    }
    if (typeof raw !== "string")
      continue;
    const trimmed = raw.trim();
    if (!/^https?:\/\//i.test(trimmed))
      continue;
    try {
      const url = new URL(trimmed);
      if (!ALLOWED_PROTOCOLS.has(url.protocol))
        continue;
      if (BLOCKED_HOSTS.has(url.hostname))
        continue;
      return url.toString();
    } catch {
      continue;
    }
  }
  return;
}
function collectImages(record, graphIndex) {
  const images = [];
  const queue = [record.image, record.photo, record.thumbnailUrl];
  while (queue.length > 0) {
    const current = queue.shift();
    if (typeof current === "string") {
      const referenced = graphIndex.get(current);
      if (referenced) {
        queue.push(referenced.url, referenced.contentUrl, referenced["@id"]);
        continue;
      }
      const found = normalizeImageUrl(current);
      if (found)
        images.push(found);
    } else if (Array.isArray(current)) {
      queue.push(...current);
    } else if (current && typeof current === "object") {
      const nested = current;
      queue.push(nested.url, nested.contentUrl, nested["@id"]);
    }
  }
  return images;
}
function imagesFromJsonLd(html) {
  const images = [];
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object")
          continue;
        const record = node;
        const graph = Array.isArray(record["@graph"]) ? record["@graph"] : [];
        const graphIndex = new Map;
        for (const child of graph) {
          if (!child || typeof child !== "object")
            continue;
          const id = child["@id"];
          if (typeof id === "string")
            graphIndex.set(id, child);
        }
        images.push(...collectImages(record, graphIndex));
        for (const child of graph) {
          if (!child || typeof child !== "object")
            continue;
          const childRecord = child;
          if (!String(childRecord["@type"] ?? "").includes("Event"))
            continue;
          images.push(...collectImages(childRecord, graphIndex));
        }
      }
    } catch {}
  }
  return images;
}
function imageFromMeta(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match)
      return normalizeImageUrl(match[1]);
  }
  return;
}
var onRequestGet = async ({ request, env }) => {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");
  if (!target)
    return json({ error: "Parametern 'url' krävs." }, 400);
  let parsedTarget;
  try {
    parsedTarget = new URL(target);
  } catch {
    return json({ error: "Ogiltig URL." }, 400);
  }
  if (!ALLOWED_PROTOCOLS.has(parsedTarget.protocol) || BLOCKED_HOSTS.has(parsedTarget.hostname)) {
    return json({ error: "URL:en är inte tillåten." }, 400);
  }
  const cacheKey = new Request(`https://event-image-cache.hander.internal/?url=${encodeURIComponent(parsedTarget.toString())}`, { method: "GET" });
  const cache = await edgeCache();
  const cached = await cache.match(cacheKey);
  if (cached)
    return cached;
  try {
    const response = await fetch(parsedTarget.toString(), {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; HanderApp/1.0; +https://hander.pages.dev)",
        accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!response.ok) {
      return json({ image: null, reason: `arrangör svarade ${response.status}` }, 200, { "cache-control": "public, max-age=1800" });
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      return json({ image: null, reason: "sida för stor" }, 200, { "cache-control": "public, max-age=1800" });
    }
    const html = new TextDecoder("utf-8").decode(buffer);
    const image = imagesFromJsonLd(html)[0] ?? imageFromMeta(html);
    const body = json({ image: image ?? null, source: parsedTarget.hostname });
    const cacheResponse = body.clone();
    cacheResponse.headers.set("cache-control", `public, max-age=${CACHE_TTL_SECONDS}`);
    cache.put(cacheKey, cacheResponse).catch(() => {
      return;
    });
    return body;
  } catch {
    return json({ image: null, reason: "kunde inte hämta arrangörssidan" }, 200, { "cache-control": "public, max-age=1800" });
  }
};

// src/lib/event-source.ts
var RAW = [
  ["John Scott’s Kungsgatan", "https://www.johnscotts.se", "sport"],
  ["Birka bowling och darts", "https://www.birkabowling.se", "sport"],
  ["Ballbreakers", "https://www.ballbreaker.se", "sport"],
  ["Pharmarium", "https://www.pharmarium.se", "fest"],
  ["20hundra5", "https://www.noll5.se", "fest"],
  ["Crum Heaven", "https://www.instagram.com/crumheaven/", "mat"],
  ["Bistro Bananas", "https://www.bistrobananas.se", "mat"],
  ["Tilt bar", "https://www.tiltbar.se", "fest"],
  ["Taysta mordgåtor", "https://www.taysta.se", "ovrigt"],
  ["Escape Stories", "https://www.escapestories.com", "ovrigt"],
  ["Fox in a Box", "https://www.foxinabox.se", "ovrigt"],
  ["Questrooms", "https://www.questrooms.se", "ovrigt"],
  ["Stockholm Ghost Walk", "https://www.stockholmghostwalk.com", "kultur"],
  ["Marathongruppen", "https://www.marathongruppen.se", "sport"],
  ["Punk Royale", "https://www.punkroyale.com", "mat"],
  ["Norra Brunn", "https://www.norrabrunncomedy.se", "kultur"],
  ["Pang Pang Brewery", "https://www.pangpangbrewery.se", "mat"],
  ["Kappa bar", "https://www.kappabar.se", "sport"],
  ["Sci-fi bokhandeln", "https://www.sfbok.se", "shopping"],
  ["Stuntgruppen", "https://www.stuntgruppen.se", "ovrigt"],
  ["Hornstulls marknad", "https://www.hornstullsmarknad.se", "shopping"],
  ["Big Ben comedy", "https://www.bigbenstandup.com", "kultur"],
  ["K karaoke", "https://www.kkaraoke.se", "fest"],
  ["Moyagi karaoke", "https://www.moyagi.com", "fest"],
  ["Bouldering Stockholm", "https://www.boulderingstockholm.se", "sport"],
  ["Högt och lågt", "https://www.hogtlagt.se", "fest"],
  ["Stockholms kommun", "https://www.stockholm.se"],
  ["Vrex city", "https://www.vrex.se", "ovrigt"],
  ["Stockholmsmässan", "https://www.stockholmsmassan.se", "shopping"],
  ["Keramiken", "https://www.keramiken.se", "kultur"],
  ["Drejverkstaden", "https://www.drejverkstaden.se", "kultur"],
  ["Perla Stockholm", "https://www.perlasthlm.se", "shopping"],
  ["Atelje FAFF", undefined, "kultur"],
  ["Kulturama", "https://www.kulturama.se", "student"],
  ["STHLM Ljusstöperi", "https://www.sthlmljusstoperi.se", "kultur"],
  ["Maffia comedy club", "https://www.maffiacomedy.se", "kultur"],
  ["Stockholms improvisationsteater", "https://www.impro.a.se", "kultur"],
  ["Improstudion", "https://www.improvisationsstudion.se", "kultur", ["stage"]],
  ["Golfbaren", "https://www.golfbaren.se", "sport"],
  ["Dance Factory", "https://www.dancefactory.se", "fest"],
  ["Danshuset", "https://www.danshuset.se", "fest"],
  ["Fryshuset", "https://www.fryshuset.se", "kultur", ["stage"]],
  ["Nationalmuseum", "https://www.nationalmuseum.se", "kultur"],
  ["Naturhistoriska", "https://www.nrm.se", "kultur"],
  ["Tekniska museet", "https://www.tekniska.se", "kultur"],
  ["Ugglan Boule & Bar", "https://www.ugglanboulebar.se", "sport"],
  ["Boulebar Tanto", "https://www.boulebar.se", "sport"],
  ["Boulebar Rålambshov", "https://www.boulebar.se", "sport"],
  ["Tolv Stockholm", "https://www.tolvstockholm.se", "sport"],
  ["O'Learys Tolv", "https://www.olearys.se/tolv-stockholm", "sport"],
  ["RoQ", "https://www.roq.nu", "fest"],
  ["Biljardpalatset", "https://www.biljardpalatset.se", "sport"],
  ["Jolo", "https://www.jolo.nu", "fest"],
  ["Laserdome Surbrunnsgatan", "https://www.laserdome.se", "ovrigt"],
  ["Laserdome Hägersten", "https://www.laserdome.se", "ovrigt"],
  ["Prison Island Stockholm", "https://www.prisonisland.se/stockholm", "ovrigt"],
  ["Boda Borg Oxelösund", "https://www.bodaborg.se", "ovrigt"],
  ["Paradox Museum", "https://www.paradoxmuseumstockholm.com", "kultur"],
  ["Avicii Experience", "https://www.aviciiexperience.com", "kultur"],
  ["ABBA The Museum", "https://www.abbathemuseum.com", "kultur"],
  ["Fotografiska", "https://www.fotografiska.com/sto", "kultur"],
  ["Moderna Museet", "https://www.modernamuseet.se", "kultur"],
  ["ArkDes", "https://www.arkdes.se", "kultur"],
  ["Vrak – Museum of Wrecks", "https://www.vrak.se", "kultur"],
  ["Vasamuseet", "https://www.vasamuseet.se", "kultur"],
  ["Vikingamuseet", "https://www.thevikingmuseum.com", "kultur"],
  ["Spritmuseum", "https://www.spritmuseum.se", "kultur"],
  ["Livrustkammaren", "https://www.livrustkammaren.se", "kultur"],
  ["Medeltidsmuseet", "https://www.medeltidsmuseet.stockholm.se", "kultur"],
  ["Hallwylska museet", "https://www.hallwylskamuseet.se", "kultur"],
  ["Nordiska museet", "https://www.nordiskamuseet.se", "kultur"],
  ["Skansen", "https://www.skansen.se", "kultur"],
  ["Gröna Lund", "https://www.gronalund.com", "ovrigt"],
  ["SkyView", "https://www.stockholmlive.com/skyview", "ovrigt"],
  ["Takvandring i Gamla stan", "https://www.takvandring.com", "utomhus"],
  ["Ocean Bus", "https://www.oceanbus.se", "utomhus"],
  ["RIB-båt i skärgården", "https://www.ribcharter.se", "utomhus"],
  ["Kajakpaddling i stan", "https://www.langholmenkajak.se", "utomhus"],
  ["Brunnsvikens Kanotklubb", "https://www.bkk.se", "utomhus"],
  ["SUP-paddling vid Rålambshovsparken", "https://www.kajakkompaniet.se", "utomhus"],
  ["Skinnarviksberget", "https://www.visitstockholm.se", "utomhus"],
  ["Monteliusvägen", "https://www.visitstockholm.se", "utomhus"],
  ["Ivar Los park", "https://www.visitstockholm.se", "utomhus"],
  ["Fåfängan", "https://www.fafangan.se", "utomhus"],
  ["Fjällgatan", "https://www.visitstockholm.se", "utomhus"],
  ["Rosendals Trädgård", "https://www.rosendalstradgard.se", "utomhus"],
  ["Bergianska trädgården", "https://www.bergianska.se", "utomhus"],
  ["Hagaparken", "https://www.kungligaslotten.se", "utomhus"],
  ["Fjärilshuset Haga Ocean", "https://www.fjarilshuset.se", "utomhus"],
  ["Hellasgården", "https://www.hellasgarden.se", "utomhus"],
  ["Tanto Bastu", "https://www.tantobastu.se", "sport"],
  ["Centralbadet", "https://www.centralbadet.se", "sport"],
  ["Sturebadet", "https://www.sturebadet.se", "sport"],
  ["Yasuragi", "https://www.yasuragi.se", "sport"],
  ["Klättercentret Telefonplan", "https://www.klattercentret.se/telefonplan", "sport"],
  ["Klättercentret Akalla", "https://www.klattercentret.se/akalla", "sport"],
  ["Klättercentret Solna", "https://www.klattercentret.se/solna", "sport"],
  ["Klätterverket Sickla", "https://www.klatterverket.se", "sport"],
  ["Moumo", "https://www.moumo.se", "sport"],
  ["Padel Zenter Årsta", "https://www.padelzenter.se", "sport"],
  ["PDL Center Frihamnen", "https://www.pdlcenter.se", "sport"],
  ["Södermalms Padel", "https://www.sodermalmspadel.se", "sport"],
  ["JumpYard Barkarby", "https://www.jumpyard.se/barkarby", "sport"],
  ["JumpYard Nacka Forum", "https://www.jumpyard.se/nacka", "sport"],
  ["Yoump Kungens Kurva", "https://www.yoump.se", "sport"],
  ["Gokart Stockholm", "https://www.gokartstockholm.se", "sport"],
  ["O'Learys Mall of Scandinavia", "https://www.olearys.se/mall-of-scandinavia", "sport"],
  ["Kungsängen Gokart", "https://www.kungsangengokart.se", "sport"],
  ["Spelapaintball Farsta", "https://www.spelapaintball.com", "sport"],
  ["AC Paintball", "https://www.acpaintball.se", "sport"],
  ["Curling i Danderyd", "https://www.danderydscurling.se", "sport"],
  ["Sundbybergs Curlinghall", "https://www.sumpycurling.se", "sport"],
  ["Skridskor i Kungsträdgården", "https://www.kungstradgarden.se", "sport"],
  ["Zinkensdamms IP", "https://www.stockholm.se", "sport"],
  ["Östermalms IP", "https://www.stockholm.se", "sport"],
  ["Hammarbybacken", "https://www.skistar.com/hammarbybacken", "utomhus"],
  ["Flottsbro", "https://www.flottsbro.se", "utomhus"],
  ["Lida Friluftsgård", "https://www.lida.se", "utomhus"],
  ["Siggesta Gård", "https://www.siggestagard.se", "utomhus"],
  ["Golfbaren Kristineberg", "https://www.golfbaren.se", "sport"],
  ["Swing by Golfbaren", "https://www.swingbygolfbaren.se", "sport"],
  ["Camping", "https://www.camping.se/stockholm", "utomhus"],
  ["Eldorado", "https://www.eldoradostockholm.se", "mat"],
  ["Hey Sthlm", "https://www.heysthlm.se", "fest"],
  ["N3rds Bar", "https://www.n3rdsbar.se", "fest"],
  ["Dragon’s Lair", "https://www.dragonslair.se", "ovrigt"],
  ["Alphaspel", "https://www.alphaspel.se", "ovrigt"],
  ["Dice Coffee", "https://www.dicecoffee.se", "mat"],
  ["Snövit", "https://www.snovit.nu", "fest"],
  ["Hirschenkeller", "https://www.hirschenkeller.se", "fest"],
  ["Dovaz", "https://www.dovaz.se", "fest"],
  ["Baras Imperium", "https://www.baras.se", "fest"],
  ["Lion Bar Sveavägen", "https://www.lionbar.se", "fest"],
  ["Bishops Arms", "https://www.bishopsarms.com", "fest"],
  ["The Liffey", "https://www.theliffey.se", "fest", ["stage"]],
  ["Wirströms Pub", "https://www.wirstromspub.se", "fest"],
  ["Stampen", "https://www.stampen.se", "musik", ["stage"]],
  ["Fasching", "https://www.fasching.se", "musik", ["stage"]],
  ["Debaser Strand", "https://www.debaser.se", "musik", ["name", "stage"]],
  ["Slaktkyrkan", "https://www.slaktkyrkan.se", "musik", ["stage"]],
  ["Fållan", "https://www.fallan.nu", "musik", ["stage"]],
  ["Hosoi", "https://www.hosoi.se", "fest"],
  ["Trädgården", "https://www.tradgarden.com", "fest"],
  ["Under Bron", "https://www.underbron.com", "fest"],
  ["Berns", "https://www.berns.se", "fest", ["stage"]],
  ["Nalen", "https://www.nalen.com", "musik", ["stage"]],
  ["Södra Teatern", "https://www.sodrateatern.com", "musik", ["stage"]],
  ["RAW Comedy Club", "https://www.rawcomedy.se", "kultur"],
  ["Boulevardteatern", "https://www.boulevardteatern.se", "kultur"],
  ["Scalateatern", "https://www.scalateatern.se", "kultur", ["stage"]],
  ["Bio Rio", "https://www.biorio.se", "kultur"],
  ["Zita Folkets Bio", "https://www.zita.se", "kultur"],
  ["Capitol Bio", "https://www.capitolbio.se", "kultur"],
  ["Rigoletto", "https://www.filmstaden.se", "kultur"],
  ["Filmstaden Scandinavia", "https://www.filmstaden.se", "kultur"],
  ["Cinemateket", "https://www.cinemateket.se", "kultur"],
  ["Stockholms stadsbibliotek", "https://www.biblioteket.stockholm.se", "kultur"],
  ["Kulturhuset Stadsteatern", "https://www.kulturhusetstadsteatern.se", "kultur", ["stage"]],
  ["Konstfack", "https://www.konstfack.se", "student"],
  ["Beckmans Designhögskola", "https://www.beckmans.se", "student"],
  ["Kungliga Konsthögskolan", "https://www.kkh.se", "student"],
  ["Långholmen", "https://www.langholmen.com", "utomhus"],
  ["Brunnsviksbadet", "https://www.stockholm.se", "utomhus"],
  ["Fredhällsklipporna", "https://www.visitstockholm.se", "utomhus"],
  ["Smedsuddsbadet", "https://www.stockholm.se", "utomhus"],
  ["Tanto strandbad", "https://www.stockholm.se", "utomhus"],
  ["Vinterviken", "https://www.vinterviken.com", "utomhus"],
  ["Årstaviken", "https://www.visitstockholm.se", "utomhus"],
  ["Djurgården runt", "https://www.visitstockholm.se", "utomhus"],
  ["Pampas Marina", "https://www.pampas.se", "utomhus"],
  ["Waxholmsbolaget", "https://www.waxholmsbolaget.se", "utomhus"],
  ["Vaxholm", "https://www.upplevvaxholm.se", "utomhus"],
  ["Fjäderholmarna", "https://www.fjaderholmarna.se", "utomhus"],
  ["Grinda", "https://www.grinda.se", "utomhus"],
  ["Utö", "https://www.uto.se", "utomhus"],
  ["Sigtuna", "https://www.destinationsigtuna.se", "utomhus"],
  ["Drottningholms slott", "https://www.kungligaslotten.se", "kultur"],
  ["Tyresta nationalpark", "https://www.sverigesnationalparker.se", "utomhus"],
  ["Nackareservatet", "https://www.stockholm.se", "utomhus"],
  ["Lida Loop", "https://www.hellasgarden.se", "utomhus"],
  ["KTH-hallen", "https://www.kth.se", "sport"],
  ["Frescati Sports Center", "https://www.ssif.nu", "sport"],
  ["Friskis&Svettis Stockholm", "https://www.friskissvettis.se/stockholm", "sport"],
  ["SATS Student", "https://www.sats.se", "sport"],
  ["Målerikväll med vin", "https://www.paintandsip.se", "kultur"],
  ["Dreja och drick vin", "https://www.lerverkstad.se", "kultur"],
  ["Kockduellen", "https://www.avedo.se", "mat"],
  ["Surdegskurs på bageri", "https://www.fabrique.se", "mat"],
  ["Ölprovning på mikrobryggeri", "https://www.omnipolloshatt.com", "mat"],
  ["Chokladprovning i Gamla stan", "https://www.chokladfabriken.se", "mat"],
  ["Ost- och vinprovning", "https://www.androuet.se", "mat"],
  ["Teprovning på Tehuset Java", "https://www.tehusetjava.se", "mat"],
  ["Kaffeprovning på Johan & Nyström", "https://www.johanochnystrom.se", "mat"],
  ["Ramen-verkstad", "https://www.ramenki-mama.se", "mat"],
  ["Loppisrunda på Södermalm", "https://www.beyondretro.com", "shopping"],
  ["Hötorgets loppis", "https://www.visitstockholm.se", "shopping"],
  ["Täby Galopp bakluckeloppis", "https://www.loppistajm.se", "shopping"],
  ["Solvalla", "https://www.solvalla.se", "sport"],
  ["Tele2 Arena", "https://www.stockholmlive.com"],
  ["Avicii Arena", "https://www.stockholmlive.com"],
  ["Kungliga Operan", "https://www.operan.se", "kultur", ["stage"]],
  ["Dramaten", "https://www.dramaten.se", "kultur"],
  ["Café Bojan", "https://www.samvet.se", "student"],
  ["Gréens villa", "https://www.nf.su.se", "student"],
  ["Gula villan", "https://www.humf.su.se", "student"],
  ["Juristernas hus", "https://www.juridiskaforeningen.se", "student"],
  ["Nymble", "https://www.ths.kth.se", "student"],
  ["Medicinska Föreningen", "https://www.medicinskaforeningen.se", "student"],
  ["SöderS pub", "https://www.soders.nu", "student"],
  ["Uppsala studentnationer", "https://www.uppsalastudent.com", "student"],
  ["Språkcafé på Stadsbiblioteket", "https://www.biblioteket.stockholm.se", "student"],
  ["Handelshögskolans bibliotek", "https://www.hhs.se", "student"],
  ["KTH Biblioteket", "https://www.kth.se/biblioteket", "student"],
  ["Stockholms universitetsbibliotek", "https://www.su.se/biblioteket", "student"],
  ["Södertörns högskolebibliotek", "https://www.sh.se/biblioteket", "student"],
  ["Accelerator", "https://www.acceleratorsu.se", "kultur"],
  ["Bonniers Konsthall", "https://www.bonnierskonsthall.se", "kultur"],
  ["Liljevalchs konsthall", "https://www.liljevalchs.se", "kultur"],
  ["Färgfabriken", "https://www.fargfabriken.se", "kultur"],
  ["Sven-Harrys konstmuseum", "https://www.sven-harrys.se", "kultur"],
  ["Marabouparken konsthall", "https://www.marabouparken.se", "kultur"],
  ["Konstakademien", "https://www.konstakademien.se", "kultur"],
  ["Prins Eugens Waldemarsudde", "https://www.waldemarsudde.se", "kultur"],
  ["Stadsmuseet i Stockholm", "https://www.stadsmuseet.stockholm.se", "kultur"],
  ["Riksidrottsmuseet", "https://www.riksidrottsmuseet.se", "kultur"],
  ["Armémuseum", "https://www.armemuseum.se", "kultur"],
  ["Forum för levande historia", "https://www.levandehistoria.se", "kultur"],
  ["Strindbergsmuseet", "https://www.strindbergsmuseet.se", "kultur"],
  ["Subtopias utomhusgalleri", "https://www.subtopia.se", "kultur"],
  ["Tunnelbanekonsten", "https://www.sl.se", "kultur"],
  ["Vaktparaden vid Stockholms slott", "https://www.forsvarsmakten.se", "kultur"],
  ["Millesgården", "https://www.millesgarden.se", "kultur"],
  ["Artipelag", "https://www.artipelag.se", "kultur"],
  ["Birka Vikingastaden", "https://www.birkavikingastaden.se", "kultur"],
  ["Drottningholms Slottsteater", "https://www.dtm.se", "kultur"],
  ["Kina slott", "https://www.kungligaslotten.se", "kultur"],
  ["Rosendals slott", "https://www.kungligaslotten.se", "kultur"],
  ["Thielska Galleriet", "https://www.thielskagalleriet.se", "kultur"],
  ["Tekniska museets Wisdome", "https://www.tekniskamuseet.se", "kultur"],
  ["Polismuseet", "https://www.polismuseet.se", "kultur"],
  ["Sjöhistoriska museet", "https://www.sjohistoriska.se", "kultur"],
  ["Etnografiska museet", "https://www.etnografiskamuseet.se", "kultur"],
  ["Medelhavsmuseet", "https://www.medelhavsmuseet.se", "kultur"],
  ["Östasiatiska museet", "https://www.ostasiatiskamuseet.se", "kultur"],
  ["Dansmuseet", "https://www.dansmuseet.se", "kultur"],
  ["Scenkonstmuseet", "https://www.scenkonstmuseet.se", "kultur"],
  ["Nobelmuseet", "https://www.nobelprize.org", "kultur"],
  ["Kungliga Myntkabinettet", "https://www.ekonomiskamuseet.se", "kultur"],
  ["Spårvägsmuseet", "https://www.sparvagsmuseet.se", "kultur"],
  ["Leksaksmuseet", "https://www.bergrummet.com", "kultur"],
  ["Bergrummet Tidö Collection", "https://www.bergrummet.com", "kultur"],
  ["Observatoriemuseet", "https://www.observatoriet.se", "kultur"],
  ["Judiska museet", "https://www.judiskamuseet.se", "kultur"],
  ["Postmuseum", "https://www.postmuseum.se", "kultur"],
  ["K.A. Almgren sidenväveri", "https://www.kasiden.se", "kultur"],
  ["Carl Eldhs Ateljémuseum", "https://www.eldhsatelje.se", "kultur"],
  ["Bror Hjorths Hus", "https://www.brorhjorthshus.se", "kultur"],
  ["Magasin III", "https://www.magasin3.com", "kultur"],
  ["CFHILL", "https://www.cfhill.com", "kultur"],
  ["Wetterling Gallery", "https://www.wetterlinggallery.com", "kultur"],
  ["Galleri Glas", "https://www.galleriglas.se", "kultur"],
  ["Sergelgatans konsthall", "https://www.sergelgatanskonsthall.se", "kultur"],
  ["Kulturhuset Lava", "https://www.kulturhusetstadsteatern.se", "kultur"],
  ["Dieselverkstaden", "https://www.dieselverkstaden.se", "kultur"],
  ["Subtopia", "https://www.subtopia.se", "kultur"],
  ["Cirkus Cirkör", "https://www.cirkor.se", "kultur"],
  ["Orionteatern", "https://www.orionteatern.se", "kultur"],
  ["Teater Galeasen", "https://www.galeasen.se", "kultur"],
  ["Turteatern", "https://www.turteatern.se", "kultur"],
  ["Playhouse Teater", "https://www.playhouseteater.se", "kultur"],
  ["Strindbergs Intima Teater", "https://www.strindbergsintimateater.se", "kultur"],
  ["Folkoperan", "https://www.folkoperan.se", "kultur", ["stage"]],
  ["Bio Aspen", "https://www.bioaspen.se", "kultur"],
  ["Bio Tellus", "https://www.tellusbio.nu", "kultur"],
  ["Stadsbibliotekets Rotunda", "https://www.biblioteket.stockholm.se", "kultur"],
  ["Kungliga biblioteket", "https://www.kb.se", "kultur"],
  ["Serieteket", "https://www.kulturhusetstadsteatern.se", "kultur"],
  ["Vaxholms Kastell", "https://www.kastellet.com", "kultur"],
  ["Mormors Dumplings", "https://www.mormorsdumplings.se", "mat"],
  ["Herman’s", "https://www.hermans.se", "mat"],
  ["La Neta", "https://www.laneta.se", "mat"],
  ["Babas Burgers & Bites", "https://www.babas.nu", "mat"],
  ["Meno Male", "https://www.menomale.se", "mat"],
  ["Omnipollos Hatt", "https://www.omnipolloshatt.com", "mat"],
  ["Kaffeverket", "https://www.kaffeverket.se", "mat"],
  ["Café Pascal", "https://www.cafepascal.se", "mat"],
  ["Gast Café", "https://www.gastcafe.se", "mat"],
  ["Pom & Flora", "https://www.pomochflora.se", "mat"],
  ["Schmaltz Bar & Delicatessen", "https://www.schmaltz.se", "mat"],
  ["Cave Nizza", "https://www.cavenizza.se", "mat"],
  ["Restaurang Bleck", "https://www.restaurangbleck.se", "mat"],
  ["Geronimo’s FGT", "https://www.geronimosfgt.se", "mat"],
  ["Gondolen", "https://www.gondolen.se", "mat"],
  ["Urban Deli Sveavägen", "https://www.urbandeli.org", "mat"],
  ["Spesso", "https://www.spesso.se", "mat"],
  ["Östermalms Saluhall", "https://www.ostermalmshallen.se", "mat"],
  ["Savant Bar", "https://www.savantbar.se", "fest"],
  ["Bar Ninja", "https://www.barninja.se", "fest"],
  ["Eden Smedsuddsbadet", "https://www.edensthlm.se", "fest"],
  ["Tak", "https://www.tak.se", "fest"],
  ["Stockholm Under Stjärnorna", "https://www.sthlmunderstjarnorna.com", "fest"],
  ["Himlen", "https://www.restauranghimlen.se", "fest"],
  ["Freyja + Söder", "https://www.freyjasoder.se", "fest"],
  ["Pelago", "https://www.pelago.se", "fest"],
  ["Arc Rooftop", "https://www.arcrooftop.se", "fest"],
  ["Le Hibou", "https://www.bankhotel.se", "fest"],
  ["Mälarpaviljongen", "https://www.malarpaviljongen.se", "fest"],
  ["Loopen Marina", "https://www.loopenmarina.se", "fest"],
  ["Melodybox", "https://www.melodybox.se", "musik", ["stage"]],
  ["Restaurang Landet", "https://www.restauranglandet.se", "musik", ["stage"]],
  ["Reimersholme Hotel", "https://www.reimersholmehotel.se", "musik", ["stage"]],
  ["Långholmens Wärdshus", "https://www.langholmen.com", "musik", ["stage"]],
  ["Lydmar Hotel", "https://www.lydmar.com", "musik", ["stage"]],
  ["Mosebacketerrassen", "https://www.sodrateatern.com", "musik", ["stage"]],
  ["Konserthuset Stockholm", "https://www.konserthuset.se", "musik", ["stage"]],
  ["Berwaldhallen", "https://www.berwaldhallen.se", "musik", ["stage"]],
  ["Eric Ericsonhallen", "https://www.ericericsonhallen.se", "musik", ["stage"]],
  ["3Arena", "https://www.stockholmlive.com", "sport"],
  ["Strawberry Arena", "https://www.strawberryarena.se", "sport"],
  ["Eriksdalsbadet", "https://www.stockholm.se", "sport"],
  ["Boule & Berså", "https://www.boulebersa.se", "sport"],
  ["Tantolundens Bangolf", "https://www.tantobangolf.se", "sport"],
  ["Kristinebergs Golfbar", "https://www.golfbaren.se", "sport"],
  ["Kungsholmens Bangolf", "https://www.bangolf.se", "sport"],
  ["Eriksdals Bangolf", "https://www.stockholm.se", "sport"],
  ["Rålambshovsparken Skatepark", "https://www.stockholm.se", "sport"],
  ["Highvalley Skateworld", "https://www.stockholm.se", "sport"],
  ["Fryshuset Skatepark", "https://www.fryshuset.se", "sport"],
  ["Kristinebergs IP", "https://www.stockholm.se", "sport"],
  ["Stadion", "https://www.stockholm.se", "sport"],
  ["Hagaparken Tennis", "https://www.hagaparkentennis.se", "sport"],
  ["Kungliga Tennishallen", "https://www.kltk.se", "sport"],
  ["Eriksdalshallen", "https://www.stockholm.se", "sport"],
  ["Enskede Rackethall", "https://www.enskederackethall.se", "sport"],
  ["Frescati Sports Center Badminton", "https://www.ssif.nu", "sport"],
  ["Gärdet Frisbeegolf", "https://www.discgolfbanor.se", "sport"],
  ["Kärsön Discgolf", "https://www.discgolfbanor.se", "sport"],
  ["Järva Discgolf Park", "https://www.discgolfpark.com", "sport"],
  ["Tantolundens Discgolf", "https://www.discgolfbanor.se", "sport"],
  ["SL-båtarna Linje 80 & 89", "https://www.sl.se", "utomhus"],
  ["Kampementsbadet", "https://www.stockholm.se", "utomhus"],
  ["Ulriksdals Slottsträdgård", "https://www.ulriksdalsslottstradgard.se", "utomhus"],
  ["Lilla & Stora Essingen runt", "https://www.visitstockholm.se", "utomhus"],
  ["Görvälns slott & klipporna", "https://www.gorvalnsslott.se", "utomhus"],
  ["Katarinahissen", "https://www.visitstockholm.se", "utomhus"],
  ["Vanadisbadet", "https://www.vanadisbadet.se", "utomhus"],
  ["Tantolundens koloniområde", "https://www.visitstockholm.se", "utomhus"],
  ["Judarskogens naturreservat", "https://www.stockholm.se", "utomhus"],
  ["Grimsta naturreservat", "https://www.stockholm.se", "utomhus"],
  ["Kanaanbadet & Trädgårdscaféet", "https://www.kanaan.se", "utomhus"],
  ["Sätraskogens naturreservat", "https://www.stockholm.se", "utomhus"],
  ["Älvsjöskogen", "https://www.stockholm.se", "utomhus"],
  ["Haga Ruiner", "https://www.kungligaslotten.se", "utomhus"],
  ["Kinesiska paviljongen i Hagaparken", "https://www.kungligaslotten.se", "utomhus"],
  ["Cedergrenska tornet", "https://www.cedergrenskatornet.se", "utomhus"],
  ["Bockholmen", "https://www.bockholmen.com", "utomhus"],
  ["Ulriksdals slottspark", "https://www.kungligaslotten.se", "utomhus"],
  ["Nyckelviken", "https://www.nacka.se", "utomhus"],
  ["Velamsunds naturreservat", "https://www.nacka.se", "utomhus"],
  ["Paradiset i Hanveden", "https://www.huddinge.se", "utomhus"],
  ["Björnö naturreservat", "https://www.skargardsstiftelsen.se", "utomhus"],
  ["Bogesundslandet", "https://www.skargardsstiftelsen.se", "utomhus"],
  ["Stendörrens naturreservat", "https://www.lansstyrelsen.se", "utomhus"],
  ["Gålö havsbad", "https://www.skargardsstiftelsen.se", "utomhus"],
  ["Nynäshamn & Strandvägen", "https://www.visitnynashamn.se", "utomhus"],
  ["Mariefred & Gripsholms slott", "https://www.kungligaslotten.se", "utomhus"],
  ["Kayaker i Liljeholmskajen", "https://www.kayakomat.com", "utomhus"],
  ["Kayakomat Rålambshovsparken", "https://www.kayakomat.com", "utomhus"],
  ["Kayakomat Hornstull", "https://www.kayakomat.com", "utomhus"],
  ["Kayakomat Pampas Marina", "https://www.kayakomat.com", "utomhus"],
  ["GoBoat Stockholm", "https://www.goboat.se", "utomhus"],
  ["Strömma Kanalbolaget", "https://www.stromma.com", "utomhus"],
  ["M/S Emelie", "https://www.ressel.se", "utomhus"],
  ["Djurgårdsfärjan", "https://www.sl.se", "utomhus"],
  ["Sandhamn", "https://www.destinationsandhamn.se", "utomhus"],
  ["Möja", "https://www.visitstockholm.se", "utomhus"],
  ["Finnhamn", "https://www.finnhamn.se", "utomhus"],
  ["Svartsö", "https://www.visitstockholm.se", "utomhus"],
  ["Ingmarsö", "https://www.visitstockholm.se", "utomhus"],
  ["Landsort / Öja", "https://www.visitnynashamn.se", "utomhus"],
  ["Bondens egen marknad", "https://www.bondensegen.com", "shopping"],
  ["Lisa Larsson Second Hand", "https://www.instagram.com/lisalarssonsecondhand", "shopping"],
  ["Old Touch", "https://www.oldtouch.se", "shopping"],
  ["Judits Second Hand", "https://www.judits.se", "shopping"],
  ["Herr Judit", "https://www.herrjudit.se", "shopping"],
  ["Arkivet", "https://www.arkivetsthlm.se", "shopping"],
  ["Humana Second Hand", "https://www.humanasecondhand.se", "shopping"],
  ["Bergenströms Rekvisita", "https://www.instagram.com/bergenstromsrekvisita", "shopping"],
  ["Rönnells Antikvariat", "https://www.ronnells.se", "shopping"],
  ["Aspuddens Bokhandel", "https://www.aspuddensbokhandel.se", "shopping"],
  ["Gamla Stans Bokhandel", "https://www.gamlastansbokhandel.se", "shopping"],
  ["Söderbokhandeln", "https://www.soderbokhandeln.se", "shopping"],
  ["Hedengrens Bokhandel", "https://www.hedengrens.se", "shopping"],
  ["Pet Sounds", "https://www.petsounds.se", "shopping"],
  ["Bengans Skivbutik", "https://www.bengans.se", "shopping"],
  ["Record Hunter", "https://www.recordhunter.se", "shopping"],
  ["Nostalgipalatset", "https://www.nostalgipalatset.com", "shopping"],
  ["Myrorna Ropsten", "https://www.myrorna.se", "shopping"],
  ["Stadsmissionen Liljeholmen", "https://www.stadsmissionen.se", "shopping"],
  ["Emmaus Stockholm / Artikel2", "https://www.artikel2.se", "shopping"],
  ["Stockholms Auktionsverk", "https://www.auktionsverket.se", "shopping"],
  ["Bukowskis", "https://www.bukowskis.com", "shopping"],
  ["KTH R1", "https://www.kth.se/r1", "musik", ["stage"]],
  ["Spårvägsmuseets modelljärnväg", "https://www.sparvagsmuseet.se", "kultur"],
  ["Medicinhistoriska museet", "https://www.medicinhistoriskamuseet.se", "kultur"],
  ["Kungliga Myntkabinettets skattkammare", "https://www.ekonomiskamuseet.se", "kultur"],
  ["Storkyrkan", "https://www.svenskakyrkan.se/stockholmsdomkyrkoforsamling", "kultur"],
  ["Riddarholmskyrkan", "https://www.kungligaslotten.se", "kultur"],
  ["Katarina kyrkogård", "https://www.svenskakyrkan.se/katarina", "kultur"],
  ["Skogskyrkogården", "https://www.skogskyrkogarden.stockholm.se", "kultur"],
  ["Norra begravningsplatsen", "https://www.stockholm.se", "kultur"],
  ["Observatorielundens solur", "https://www.visitstockholm.se", "kultur"],
  ["Tyska kyrkans klockspel", "https://www.svenskakyrkan.se/tyska", "kultur"],
  ["Mårten Trotzigs gränd", "https://www.visitstockholm.se", "kultur"],
  ["Järnpojken", "https://www.visitstockholm.se", "kultur"],
  ["Runstenen i Prästgatan", "https://www.visitstockholm.se", "kultur"],
  ["Kanonkulan i Stortorget", "https://www.visitstockholm.se", "kultur"],
  ["Schantzska huset", "https://www.visitstockholm.se", "kultur"],
  ["Brända Tomten", "https://www.visitstockholm.se", "kultur"],
  ["Stadshustornet", "https://www.stadshuset.stockholm", "kultur"],
  ["Gyllene salen", "https://www.stadshuset.stockholm", "kultur"],
  ["Sergels torgs superellips", "https://www.visitstockholm.se", "kultur"],
  ["Humlegården & Linnéstatyn", "https://www.kb.se", "kultur"],
  ["Scheelegatans art deco-fasader", "https://www.arkdes.se", "kultur"],
  ["LM-staden", "https://www.visitstockholm.se", "kultur"],
  ["Bagarmossens centrum", "https://www.visitstockholm.se", "kultur"],
  ["Vällingby centrum", "https://www.vallingbycentrum.se", "kultur"],
  ["Årsta centrum", "https://www.visitstockholm.se", "kultur"],
  ["Norra Djurgårdsstaden", "https://www.vaxer.stockholm", "kultur"],
  ["Liljeholmskajens konstpromenad", "https://www.stockholmkonst.se", "kultur"],
  ["Skeppsholmens vrakkyrkogård", "https://www.vrak.se", "kultur"],
  ["Edsbergs slott", "https://www.sollentuna.se", "kultur"],
  ["Järvafältets gravfält", "https://www.stockholm.se", "kultur"],
  ["Hässelby slott", "https://www.hasselbyslott.se", "kultur"],
  ["Klubben / Klubbensborg", "https://www.klubbensborg.se", "kultur"],
  ["Vinterviken Skulpturpark", "https://www.vinterviken.com", "kultur"],
  ["Skärholmens gård", "https://www.stockholm.se", "kultur"],
  ["Farsta Gård", "https://www.farstagard.se", "kultur"],
  ["Svindersvik", "https://www.nordiskamuseet.se", "kultur"],
  ["Kvarnholmen", "https://www.visitstockholm.se", "kultur"],
  ["Finnboda Varv", "https://www.visitstockholm.se", "kultur"],
  ["Parkteatern i Vita Bergen", "https://www.kulturhusetstadsteatern.se", "kultur"],
  ["Professorsslingan", "https://www.visitstockholm.se", "kultur"],
  ["Haga Ocean", "https://www.fjarilshuset.se", "kultur"],
  ["Ekotemplet", "https://www.kungligaslotten.se", "kultur"],
  ["Kungliga begravningsplatsen", "https://www.kungligaslotten.se", "kultur"],
  ["Spökparken", "https://www.su.se", "kultur"],
  ["Hallwylska palatsets innergård", "https://www.hallwylskamuseet.se", "kultur"],
  ["Dramatens foajé", "https://www.dramaten.se", "kultur"],
  ["Chinateatern", "https://www.showtic.se", "kultur"],
  ["Oscarsteatern", "https://www.showtic.se", "kultur", ["stage"]],
  ["Maximteatern", "https://www.maximstockholm.se", "kultur"],
  ["Intiman", "https://www.showtic.se", "kultur", ["stage"]],
  ["Weld", "https://www.weld.se", "kultur"],
  ["MDT Moderna Dansteatern", "https://www.mdtsthlm.se", "kultur"],
  ["Dansens Hus", "https://www.dansenshus.se", "kultur"],
  ["Aliasteatern", "https://www.aliasteatern.se", "kultur"],
  ["Teater Tribunalen", "https://www.tribunalen.com", "kultur"],
  ["Konträr", "https://www.kontrar.se", "kultur"],
  ["Cyklopen", "https://www.cyklopen.se", "kultur"],
  ["Göta Lejon", "https://www.gotalejon.se", "musik", ["stage"]],
  ["Cirkus på Djurgården", "https://www.cirkus.se", "musik", ["stage"]],
  ["Fylkingen", "https://www.fylkingen.se", "musik", ["stage"]],
  ["Katarina Bangata Loppis", "https://www.loppistajm.se", "shopping"],
  ["Stortorgets julmarknad", "https://www.stortorgetsjulmarknad.com", "shopping"],
  ["Rosendals äppelfestival", "https://www.rosendalstradgard.se", "shopping"],
  ["Konditori Lyran", "https://www.konditorilyran.se", "mat"],
  ["Stallmästaregården", "https://www.stallmastaregarden.se", "mat"],
  ["Hötorgshallen", "https://www.hotorgshallen.se", "mat"],
  ["Söderhallarna", "https://www.soderhallarna.se", "mat"],
  ["Teatern i Ringen", "https://www.ringen.se/teatern", "mat"],
  ["K25", "https://www.k25.nu", "mat"],
  ["Kungshallen", "https://www.kungshallen.se", "mat"],
  ["Gunthers Korvkiosk", "https://www.instagram.com/guntherskorv", "mat"],
  ["Nystekt Strömming", "https://www.nystektstromming.se", "mat"],
  ["Kajsas Fisk", "https://www.kajsasfisk.se", "mat"],
  ["Stockholms Glasshus", "https://www.stockholmsglasshus.se", "mat"],
  ["StikkiNikki", "https://www.stikkinikki.com", "mat"],
  ["Scarfo Gelato", "https://www.scarfo.se", "mat"],
  ["Arya Glass", "https://www.aryaglass.se", "mat"],
  ["Vete-Katten", "https://www.vetekatten.se", "mat"],
  ["Tössebageriet", "https://www.tosse.se", "mat"],
  ["Lillebrors Bageri", "https://www.instagram.com/lillebrorsbageri", "mat"],
  ["Socker Sucker", "https://www.sockersucker.se", "mat"],
  ["Bullar & Bröd", "https://www.bullarochbrod.se", "mat"],
  ["Valhallabageriet", "https://www.valhallabageriet.se", "mat"],
  ["Petrus Bageri", "https://www.bageripetrus.se", "mat"],
  ["Robin Delselius Bageri", "https://www.delselius.se", "mat"],
  ["Fosch Artisan Patisserie", "https://www.fosch.se", "mat"],
  ["Hasselbacken", "https://www.hasselbacken.com", "fest"],
  ["Kaknästornet", "https://www.visitstockholm.se", "utomhus"],
  ["Vårbergstoppen", "https://www.stockholm.se", "utomhus"],
  ["Högdalstoppen", "https://www.stockholm.se", "utomhus"],
  ["Johannelundstoppen", "https://www.stockholm.se", "utomhus"],
  ["Vanadislundens vattenreservoar", "https://www.stockholm.se", "utomhus"],
  ["Evert Taubes terrass", "https://www.visitstockholm.se", "utomhus"],
  ["Hammarby Sjöstad", "https://www.visitstockholm.se", "utomhus"],
  ["Beckholmen", "https://www.visitstockholm.se", "utomhus"],
  ["Kastellholmen", "https://www.visitstockholm.se", "utomhus"],
  ["Söder Mälarstrands husbåtar", "https://www.visitstockholm.se", "utomhus"],
  ["Norr Mälarstrand", "https://www.visitstockholm.se", "utomhus"],
  ["Kristinebergs strandpark", "https://www.stockholm.se", "utomhus"],
  ["Hornsbergs strand", "https://www.visitstockholm.se", "utomhus"],
  ["Karlbergs slottspark", "https://www.forsvarsmakten.se", "utomhus"],
  ["Huvudsta strand", "https://www.solna.se", "utomhus"],
  ["Pampas Marina husbåtsby", "https://www.pampas.se", "utomhus"],
  ["Råstasjön", "https://www.solna.se", "utomhus"],
  ["Lötsjön", "https://www.sundbyberg.se", "utomhus"],
  ["Tornparken", "https://www.sundbyberg.se", "utomhus"],
  ["Igelbäckens naturreservat", "https://www.stockholm.se", "utomhus"],
  ["Eggeby Gård", "https://www.eggeby.se", "utomhus"],
  ["Bögs Gård", "https://www.bogsgard.se", "utomhus"],
  ["Rösjöbadet", "https://www.sollentuna.se", "utomhus"],
  ["Kyrkhamn & Lövsta", "https://www.stockholm.se", "utomhus"],
  ["Maltesholmsbadet", "https://www.stockholm.se", "utomhus"],
  ["Åkeshovs slott", "https://www.akeshovsslott.se", "utomhus"],
  ["Ängbybadet", "https://www.stockholm.se", "utomhus"],
  ["Solviksbadet", "https://www.stockholm.se", "utomhus"],
  ["Alviks Strand", "https://www.visitstockholm.se", "utomhus"],
  ["Stora Essingens badbryggor", "https://www.stockholm.se", "utomhus"],
  ["Mälarhöjdsbadet", "https://www.stockholm.se", "utomhus"],
  ["Örnsbergs klippbad", "https://www.visitstockholm.se", "utomhus"],
  ["Sätra varv", "https://www.visitstockholm.se", "utomhus"],
  ["Flottsbro utsiktsberg", "https://www.flottsbro.se", "utomhus"],
  ["Sundby Gård", "https://www.sundby-gard.se", "utomhus"],
  ["Orlångens naturreservat", "https://www.huddinge.se", "utomhus"],
  ["Stora Sköndal", "https://www.storaskondal.se", "utomhus"],
  ["Magelungen", "https://www.stockholm.se", "utomhus"],
  ["Trekanten", "https://www.stockholm.se", "utomhus"],
  ["Sicklasjön", "https://www.nacka.se", "utomhus"],
  ["Danvikstullsbro & Hammarby sluss", "https://www.visitstockholm.se", "utomhus"],
  ["Sickla sluss", "https://www.visitstockholm.se", "utomhus"],
  ["Barnängens brygga", "https://www.visitstockholm.se", "utomhus"],
  ["Sofia kyrka & Vita Bergen", "https://www.visitstockholm.se", "utomhus"],
  ["Galärparken", "https://www.visitstockholm.se", "utomhus"],
  ["Djurgårdsbrunnskanalen", "https://www.visitstockholm.se", "utomhus"],
  ["Hundudden", "https://www.visitstockholm.se", "utomhus"],
  ["Isbladskärret", "https://www.visitstockholm.se", "utomhus"],
  ["Stora Skuggan", "https://www.visitstockholm.se", "utomhus"],
  ["Bergianska japanska damm", "https://www.bergianska.se", "utomhus"],
  ["Italienska terrassen", "https://www.bergianska.se", "utomhus"],
  ["Victoriahuset", "https://www.bergianska.se", "utomhus"],
  ["Bellevueparken", "https://www.visitstockholm.se", "utomhus"],
  ["Tegnérlunden", "https://www.visitstockholm.se", "utomhus"],
  ["Centralbadets trädgård", "https://www.centralbadet.se", "utomhus"],
  ["Berzelii park", "https://www.visitstockholm.se", "utomhus"],
  ["Strandvägens kajpromenad", "https://www.visitstockholm.se", "utomhus"],
  ["Nobelparken", "https://www.visitstockholm.se", "utomhus"],
  ["Tessinparken", "https://www.visitstockholm.se", "utomhus"],
  ["Karlaplans fontän", "https://www.visitstockholm.se", "utomhus"],
  ["Lappis skrik", "https://www.sssb.se", "student"],
  ["Vasaparkens minigolf", "https://www.stockholm.se", "sport"]
];
var CURATED_VENUES = RAW.map(([name, url, category, flags]) => ({
  name,
  ...url ? { url } : {},
  ...category ? { category } : {},
  ...flags?.includes("name") ? { nameOnly: true } : {},
  ...flags?.includes("stage") ? { stage: true } : {}
}));
var urlParts = (value) => {
  if (!value)
    return null;
  try {
    const url = new URL(value);
    return {
      host: url.hostname.replace(/^www\./i, "").toLowerCase(),
      path: url.pathname.replace(/\/+$/, "").toLowerCase()
    };
  } catch {
    return null;
  }
};
var AGGREGATOR_HOSTS = new Set([
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "eventbrite.com",
  "loppistajm.se",
  "visitstockholm.se"
]);
var hostAndParents = (host) => {
  const parts = host.split(".");
  const out = [];
  for (let i = 0;i < parts.length - 1; i++)
    out.push(parts.slice(i).join("."));
  return out;
};
var CURATED_BY_HOST = (() => {
  const index = new Map;
  for (const venue of CURATED_VENUES) {
    if (venue.nameOnly)
      continue;
    const parts = urlParts(venue.url);
    if (!parts)
      continue;
    const bucket = index.get(parts.host);
    if (bucket)
      bucket.push({ path: parts.path, venue });
    else
      index.set(parts.host, [{ path: parts.path, venue }]);
  }
  return index;
})();
var CURATED_VENUES_PER_HOST = (() => {
  const counts = new Map;
  for (const venue of CURATED_VENUES) {
    const parts = urlParts(venue.url);
    if (!parts)
      continue;
    counts.set(parts.host, (counts.get(parts.host) ?? 0) + 1);
  }
  return counts;
})();
var normalizeName = (value) => value.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9åäö']+/g, " ").trim().replace(/\s+/g, " ");
var CURATED_SINGLE_WORDS_BY_HOST = (() => {
  const index = new Map;
  for (const venue of CURATED_VENUES) {
    const name = normalizeName(venue.name);
    if (name.includes(" "))
      continue;
    const parts = urlParts(venue.url);
    if (!parts)
      continue;
    const bucket = index.get(parts.host) ?? new Map;
    bucket.set(name, venue);
    index.set(parts.host, bucket);
  }
  return index;
})();
var CURATED_BY_NAME = new Map(CURATED_VENUES.map((venue) => [normalizeName(venue.name), venue]));
var CURATED_NAMES = new Set(CURATED_BY_NAME.keys());
var CURATED_BY_HEAD = (() => {
  const index = new Map;
  for (const name of CURATED_NAMES) {
    if (!name.includes(" "))
      continue;
    const head = name.split(" ")[0] ?? "";
    if (head.length < 4)
      continue;
    const bucket = index.get(head);
    if (bucket)
      bucket.push(name);
    else
      index.set(head, [name]);
  }
  return index;
})();
function findCurated(event) {
  const target = urlParts(event.sourceUrl);
  let ambiguous;
  let ambiguousHost;
  if (target) {
    for (const host of hostAndParents(target.host)) {
      const entries = CURATED_BY_HOST.get(host);
      if (!entries)
        continue;
      const specific = entries.find(({ path, venue }) => path && (target.path === path || target.path.startsWith(`${path}/`)) && !isArena(venue) && !isStage(venue));
      if (specific)
        return { venue: specific.venue, exact: true };
      const root = entries.find(({ path }) => !path);
      if (!root || AGGREGATOR_HOSTS.has(host) || isArena(root.venue) || isStage(root.venue)) {
        continue;
      }
      if ((CURATED_VENUES_PER_HOST.get(host) ?? 0) > 1) {
        if (!ambiguous) {
          ambiguous = { venue: root.venue, exact: false };
          ambiguousHost = host;
        }
        continue;
      }
      return { venue: root.venue, exact: true };
    }
  }
  const byTitle = matchCuratedName(normalizeName(event.name));
  if (byTitle && !isArena(byTitle))
    return { venue: byTitle, exact: true };
  let onStage = false;
  const byPlace = matchCuratedName(normalizeName(event.place ?? ""));
  if (byPlace && !isArena(byPlace)) {
    if (!isStage(byPlace))
      return { venue: byPlace, exact: true };
    onStage = true;
  }
  if (onStage)
    return;
  const onHost = ambiguousHost ? CURATED_SINGLE_WORDS_BY_HOST.get(ambiguousHost) : undefined;
  if (onHost) {
    for (const [text, fromPlace] of [
      [event.name, false],
      [event.place, true]
    ]) {
      for (const word of normalizeName(text ?? "").split(" ")) {
        const venue = onHost.get(word);
        if (!venue || isArena(venue))
          continue;
        if (fromPlace && isStage(venue))
          continue;
        return { venue, exact: true };
      }
    }
  }
  return ambiguous;
}
var ARENAS = new Set(["avicii arena", "tele2 arena", "3arena", "strawberry arena"]);
var isArena = (venue) => venue ? ARENAS.has(normalizeName(venue.name)) : false;
var isStage = (venue) => venue?.stage === true;
function matchCuratedName(text) {
  if (!text)
    return;
  const exact = CURATED_BY_NAME.get(text);
  if (exact)
    return exact;
  if (!text.includes(" "))
    return;
  let offset = 0;
  for (const word of text.split(" ")) {
    const candidates = CURATED_BY_HEAD.get(word);
    if (candidates) {
      for (const curated of candidates) {
        if (!text.startsWith(curated, offset))
          continue;
        const after = text[offset + curated.length];
        if (after !== undefined && after !== " ")
          continue;
        if (offset === 0 || curated.length >= 6)
          return CURATED_BY_NAME.get(curated);
      }
    }
    offset += word.length + 1;
  }
  return;
}
function isCuratedEvent(event) {
  return findCurated(event) !== undefined;
}
var curatedCategoryFor = (event) => {
  const match = findCurated(event);
  return match?.exact ? match.venue.category : undefined;
};

// src/lib/hander-data.ts
var pad = (n) => String(n).padStart(2, "0");
var toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
var base = new Date;
base.setHours(12, 0, 0, 0);
var dayOffset = (n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
var TODAY = dayOffset(0);
var TOMORROW = dayOffset(1);
var MAP_CENTER = { lat: 59.3293, lng: 18.0686 };

// src/lib/event-category.ts
var LETTERS = "a-zåäö0-9";
var escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var stem = (words) => words.map((word) => `(?<![${LETTERS}])${escape(word)}`).join("|");
var whole = (words) => words.map((word) => `(?<![${LETTERS}])${escape(word)}(?![${LETTERS}])`).join("|");
var RULES = [
  {
    category: "musik",
    re: new RegExp(`${stem(["musik", "konsert", "julkonsert", "jazz", "spelning", "symfoni", "orkester"])}|${whole([
      "opera",
      "operan",
      "dj",
      "live"
    ])}`)
  },
  {
    category: "fest",
    re: new RegExp(`${stem(["klubb", "festival", "fest", "mingel", "disco", "party", "club"])}|${whole(["pub"])}`)
  },
  {
    category: "sport",
    re: new RegExp(`${stem([
      "sport",
      "lopp",
      "basket",
      "fotboll",
      "yoga",
      "träning",
      "wellbeing",
      "padel",
      "golf"
    ])}|${whole(["run", "race", "match", "badminton"])}`)
  },
  {
    category: "mat",
    re: new RegExp(`${stem([
      "food",
      "drink",
      "middag",
      "lunch",
      "restaurant",
      "café",
      "cafe",
      "julbord",
      "mat",
      "öl",
      "vinprovning"
    ])}|${whole(["vin"])}`)
  },
  {
    category: "student",
    re: new RegExp(stem(["student", "campus", "university", "universitet", "föreläsning", "seminar"]))
  },
  {
    category: "shopping",
    re: new RegExp(`${stem(["market", "mässa", "shopping", "loppis", "bakluckeloppis", "marknad", "julmarknad", "designmarknad"])}|${whole(["fair"])}`)
  },
  {
    category: "utomhus",
    re: new RegExp(`${stem(["outdoor", "utomhus", "vandring", "kajak", "skärgård", "naturreservat", "bad"])}|${whole([
      "natur",
      "park",
      "parken",
      "strand"
    ])}`)
  }
];
function categoryFromText(value) {
  if (!value)
    return;
  const text = value.toLowerCase();
  return RULES.find(({ re }) => re.test(text))?.category;
}
function categoryForEvent(event) {
  return categoryFromText(`${event.name} ${event.place ?? ""}`) ?? categoryFromText(event.description ?? "") ?? "kultur";
}
function resolveCategory(apiCategory, listCategory) {
  return apiCategory === "kultur" && listCategory ? listCategory : apiCategory;
}

// src/lib/visitstockholm.ts
var VISIT_STOCKHOLM_URL = "https://api.visitstockholm.com/api/public-v1/events/";
var VISIT_SWEDEN_URL = "https://data.visitsweden.com/store/search";
var MAX_PAGES = 50;
var MAX_DISTANCE_KM = 25;
var STOCKHOLM_QUERY = "public:true AND rdfType:http\\://schema.org\\/Event";
var textFor = (value) => {
  if (typeof value === "string")
    return value;
  if (value && typeof value === "object") {
    const record = value;
    const pick = (key) => typeof record[key] === "string" ? record[key] : "";
    return pick("sv") || pick("en") || pick("@value") || pick("@id") || "";
  }
  return "";
};
var stripHtml = (value) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return value;
  if (value && typeof value === "object") {
    const record = value;
    return parsePrice(record["price"]) ?? parsePrice(record["schema:price"]) ?? parsePrice(record["name"]) ?? parsePrice(record["description"]);
  }
  if (typeof value !== "string")
    return;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (/gratis|free|kostar inget|kostnadsfritt/i.test(normalized))
    return 0;
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}
function priceFromText(value) {
  if (/gratis|free|kostar inget|kostnadsfritt/i.test(value))
    return 0;
  const match = value.match(/(?:från|from|pris|entr[eé]|biljett)?\s*(\d{2,5})\s*(?:kr|sek)/i);
  return match ? Number(match[1]) : undefined;
}
var validDate = (value) => Boolean(value && /^\d{4}-\d{2}-\d{2}/.test(value));
var dateOnly = (value) => value.slice(0, 10);
var addHours = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  const total = ((hours || 0) * 60 + (minutes || 0) + 120) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
var distanceKm = (lat, lng) => {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const dLat = toRadians(lat - MAP_CENTER.lat);
  const dLng = toRadians(lng - MAP_CENTER.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(MAP_CENTER.lat)) * Math.cos(toRadians(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};
var firstFutureSchedule = (event) => {
  const today = new Date().toISOString().slice(0, 10);
  return (event.schedule?.dates ?? []).filter((slot) => validDate(slot.date) && slot.date >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
};
var toEvent = ({ id, title, description, address, venue, date, start, end, lat, lng, url, image, price, organizerId }) => {
  const distance = distanceKm(lat, lng);
  if (!date || distance > MAX_DISTANCE_KM)
    return null;
  const startTime = start && /^\d{1,2}:\d{2}/.test(start) ? start.slice(0, 5) : "12:00";
  const name = title || "Event i Stockholm";
  const category = resolveCategory(categoryForEvent({ name, place: venue, description }), curatedCategoryFor({ name, sourceUrl: url }));
  return {
    id,
    name,
    feedSource: isCuratedEvent({ name, place: venue, sourceUrl: url }) ? "curated" : "api",
    category,
    date: dateOnly(date),
    start: startTime,
    end: end && /^\d{1,2}:\d{2}/.test(end) ? end.slice(0, 5) : addHours(startTime),
    place: venue || "Stockholm",
    address: address || "Stockholm",
    price: price ?? 0,
    priceKnown: price !== undefined,
    description,
    ...typeof image === "string" && /^https?:\/\//i.test(image) ? { image } : {},
    organizerId,
    interested: [],
    visibility: "public",
    status: "approved",
    lat,
    lng,
    distance,
    ...url ? { sourceUrl: url } : {}
  };
};
var fetchJson = async (url, signal) => {
  const response = await fetch(url, { ...signal ? { signal } : {}, headers: { Accept: "application/json" } });
  if (!response.ok)
    throw new Error(`API svarade ${response.status}`);
  return response.json();
};
var fetchVisitStockholmPage = (page, signal) => fetchJson(`${VISIT_STOCKHOLM_URL}?page=${page}`, signal);
var mapVisitStockholmPage = (page) => (page.results ?? []).flatMap((event) => {
  if (!event.id || !event.location || typeof event.location.latitude !== "number" || typeof event.location.longitude !== "number")
    return [];
  const slot = firstFutureSchedule(event);
  const candidate = slot?.date || event.start_date || "";
  const date = validDate(candidate) ? candidate : "";
  const normalized = toEvent({
    id: `visit-${event.id}`,
    title: textFor(event.title),
    description: stripHtml(textFor(event.description)),
    address: event.address || event.city || "Stockholm",
    venue: event.venue_name || event.address || event.city || "Stockholm",
    date,
    start: slot?.start_time || event.start_time,
    end: slot?.end_time || event.end_time,
    lat: event.location.latitude,
    lng: event.location.longitude,
    url: event.external_website_url || undefined,
    price: parsePrice(event.price) ?? parsePrice(event.price_info) ?? parsePrice(event.cost) ?? priceFromText(stripHtml(textFor(event.description))),
    image: firstImage(event.image) || firstImage(event.images),
    organizerId: "visit-stockholm"
  });
  return normalized ? [normalized] : [];
});
async function fetchVisitStockholmPages(from, to, signal) {
  const pages = [];
  for (let start = from;start <= to; start += 6) {
    pages.push(...await Promise.all(Array.from({ length: Math.min(6, to - start + 1) }, (_, index) => fetchVisitStockholmPage(start + index, signal))));
  }
  return pages.flatMap(mapVisitStockholmPage);
}
async function fetchVisitStockholmSource(signal, maxPages = MAX_PAGES) {
  const firstPage = await fetchVisitStockholmPage(1, signal);
  const pageCount = Math.min(Math.max(firstPage.total_pages ?? 1, 1), maxPages);
  const events = mapVisitStockholmPage(firstPage);
  if (pageCount > 1)
    events.push(...await fetchVisitStockholmPages(2, pageCount, signal));
  return events;
}
var graphValue = (node, key) => textFor(node?.[key]);
var refId = (value) => {
  if (value && typeof value === "object") {
    const id = value["@id"];
    return typeof id === "string" ? id : undefined;
  }
  return;
};
function firstImage(value) {
  if (typeof value === "string")
    return /^https?:\/\//i.test(value) ? value : undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = firstImage(item);
      if (image)
        return image;
    }
    return;
  }
  if (value && typeof value === "object") {
    const record = value;
    for (const key of ["url", "contentUrl", "thumbnailUrl", "@id"]) {
      const image = firstImage(record[key]);
      if (image)
        return image;
    }
  }
  return;
}
function normalizeVisitSwedenChild(child) {
  const graph = child.metadata?.["@graph"] ?? [];
  const event = graph.find((node) => String(node["@type"] ?? "").includes("Event"));
  if (!event)
    return null;
  const geoRef = refId(event["schema:geo"]);
  const addressRef = refId(event["schema:address"]);
  const geo = graph.find((node) => node["@id"] === geoRef);
  const addressNode = graph.find((node) => node["@id"] === addressRef);
  const lat = Number(graphValue(geo, "schema:latitude"));
  const lng = Number(graphValue(geo, "schema:longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  const startDate = graphValue(event, "schema:startDate");
  if (!validDate(startDate))
    return null;
  const title = graphValue(event, "schema:name") || "Event i Sverige";
  const description = stripHtml(graphValue(event, "schema:description") || graphValue(event, "dcterms:abstract"));
  const address = graphValue(addressNode, "schema:streetAddress") || graphValue(addressNode, "schema:addressLocality") || "Stockholm";
  const image = firstImage(event["schema:image"]) || firstImage(event["schema:photo"]) || firstImage(event["image"]) || firstImage(event["photo"]);
  return toEvent({
    id: `sweden-${child.entryId || event["@id"] || title}`,
    title,
    description,
    address,
    venue: graphValue(addressNode, "schema:addressLocality") || address,
    date: startDate,
    start: startDate.includes("T") ? startDate.slice(11, 16) : "12:00",
    lat,
    lng,
    url: graphValue(event, "schema:url") || (typeof event["@id"] === "string" ? event["@id"] : undefined),
    price: parsePrice(event["schema:price"]) ?? parsePrice(event["schema:offers"]) ?? priceFromText(description),
    image,
    organizerId: "visit-sweden"
  });
}
async function fetchVisitSwedenEvents(signal) {
  const events = [];
  for (const offset of [0, 100, 200]) {
    const params = new URLSearchParams({ type: "solr", query: STOCKHOLM_QUERY, limit: "100", offset: String(offset), rdfFormat: "application/ld+json" });
    const page = await fetchJson(`${VISIT_SWEDEN_URL}?${params.toString()}`, signal);
    const normalized = (page.resource?.children ?? []).map(normalizeVisitSwedenChild).filter((event) => Boolean(event));
    events.push(...normalized);
    if ((page.resource?.children?.length ?? 0) < 100)
      break;
  }
  return events;
}
var dedupeEvents = (events) => {
  const seen = new Set;
  return events.filter((event) => {
    const key = `${event.name.toLowerCase()}|${event.date}|${event.place.toLowerCase()}`;
    if (seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
};
async function fetchVisitStockholmEvents(signal, options) {
  const maxPages = options?.maxPages;
  const results = await Promise.allSettled([
    maxPages === undefined ? fetchVisitStockholmSource(signal) : fetchVisitStockholmSource(signal, maxPages),
    fetchVisitSwedenEvents(signal)
  ]);
  const all = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return dedupeEvents(all);
}

// functions/api/events.ts
var CACHE_TTL_SECONDS2 = 60 * 60 * 24;
var UPSTREAM_TIMEOUT_MS = 25000;
var MAX_PAGES2 = 45;
var CACHE_STAMP = "v1";
function json2(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders }
  });
}
var onRequestGet2 = async ({ request, env }) => {
  const requestedPages = Number(env?.EVENTS_MAX_PAGES);
  const pageLimit = Number.isFinite(requestedPages) && requestedPages > 0 ? Math.min(requestedPages, MAX_PAGES2) : MAX_PAGES2;
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = new URL(request.url);
  cacheKey.searchParams.set("day", day);
  cacheKey.searchParams.set("v", CACHE_STAMP);
  const cacheRequest = new Request(cacheKey.toString(), { method: "GET" });
  const cache = await edgeCache();
  const cached = await cache.match(cacheRequest);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("x-hander-cache", "hit");
    return new Response(cached.body, { status: cached.status, headers });
  }
  try {
    const events = await fetchVisitStockholmEvents(AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), {
      maxPages: pageLimit
    });
    if (events.length === 0) {
      return json2({ events: [], count: 0, day, source: "visit-stockholm" }, 503, {
        "cache-control": "public, max-age=120"
      });
    }
    const partial = pageLimit < MAX_PAGES2;
    const body = json2({
      events,
      count: events.length,
      day,
      generatedAt: new Date().toISOString(),
      source: "visit-stockholm",
      partial,
      pagesFetched: pageLimit
    }, 200, { "cache-control": `public, max-age=${CACHE_TTL_SECONDS2}` });
    const cacheResponse = body.clone();
    cache.put(cacheRequest, cacheResponse).catch(() => {
      return;
    });
    const headers = new Headers(body.headers);
    headers.set("x-hander-cache", "miss");
    return new Response(body.body, { status: 200, headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "okänt fel";
    return json2({ events: [], error: `kunde inte hämta events: ${reason}` }, 503, {
      "cache-control": "public, max-age=120"
    });
  }
};

// sites/worker.ts
var API_ROUTES = {
  "/api/events": onRequestGet2,
  "/api/event-image": onRequestGet
};
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handler = API_ROUTES[url.pathname];
    if (handler) {
      if (request.method !== "GET") {
        return new Response("Metoden stöds inte.", { status: 405 });
      }
      try {
        return await handler({
          request,
          env: { ...env, EVENTS_MAX_PAGES: "16" },
          waitUntil: ctx.waitUntil,
          next: async () => new Response(null, { status: 404 }),
          params: {},
          data: {}
        });
      } catch (error) {
        const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        return new Response(JSON.stringify({ error: detail }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      }
    }
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET")
      return response;
    const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
    if (!acceptsHtml)
      return response;
    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }
};
export {
  worker_default as default
};
