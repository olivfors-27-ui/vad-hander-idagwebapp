// Manuellt utvalda ställen och aktiviteter. De kommer från en handskriven
// lista och ska aldrig märkas som temporära API-event, även när de dyker upp
// i flödet via Visit Stockholm.
//
// Listan är bara metadata: den skapar inga egna event. Den används för att
// avgöra om ett event är kuraterat (inte grått) eller ett tillfälligt
// API-event (grå ring).

import type { CategoryId, EventItem } from "./hander-data";

/**
 * "name": bara namnet får matcha (sajten hyser flera olika ställen).
 * "stage": platsen får inte göra ett event fast – scenens kvällar är
 * tillfälliga spelningar, så de ska vara grå som arenakonserter.
 */
type VenueFlag = "name" | "stage";

type RawVenue = [
  name: string,
  url?: string | undefined,
  category?: CategoryId | undefined,
  flags?: VenueFlag[] | undefined,
];

const RAW: RawVenue[] = [
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

  // Studentliv
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

  // Konst & museum
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

  // Mat & kafé
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

  // Bar & nattliv
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

  // Musik & scen
  ["Melodybox", "https://www.melodybox.se", "musik", ["stage"]],
  ["Restaurang Landet", "https://www.restauranglandet.se", "musik", ["stage"]],
  ["Reimersholme Hotel", "https://www.reimersholmehotel.se", "musik", ["stage"]],
  ["Långholmens Wärdshus", "https://www.langholmen.com", "musik", ["stage"]],
  ["Lydmar Hotel", "https://www.lydmar.com", "musik", ["stage"]],
  ["Mosebacketerrassen", "https://www.sodrateatern.com", "musik", ["stage"]],
  ["Konserthuset Stockholm", "https://www.konserthuset.se", "musik", ["stage"]],
  ["Berwaldhallen", "https://www.berwaldhallen.se", "musik", ["stage"]],
  ["Eric Ericsonhallen", "https://www.ericericsonhallen.se", "musik", ["stage"]],

  // Sport & aktivitet
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

  // Utomhus & skärgård
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

  // Shopping & marknad
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

  // Fasta platser: kultur & sevärdheter
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

  // Fasta platser: musik
  ["Göta Lejon", "https://www.gotalejon.se", "musik", ["stage"]],
  ["Cirkus på Djurgården", "https://www.cirkus.se", "musik", ["stage"]],
  ["Fylkingen", "https://www.fylkingen.se", "musik", ["stage"]],

  // Fasta platser: mat & marknad
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

  // Fasta platser: utomhus & natur
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

  // Fasta platser: student & sport
  ["Lappis skrik", "https://www.sssb.se", "student"],
  ["Vasaparkens minigolf", "https://www.stockholm.se", "sport"],
];

export type CuratedVenue = {
  name: string;
  url?: string;
  /** Listans egen kategori – används när eventet saknar en träffsäker sådan. */
  category?: CategoryId;
  /** Bara namnet får matcha – sajten huserar flera olika ställen. */
  nameOnly?: boolean;
  /** Scen: platsen ensam får inte göra ett event fast. */
  stage?: boolean;
};

export const CURATED_VENUES: CuratedVenue[] = RAW.map(([name, url, category, flags]) => ({
  name,
  ...(url ? { url } : {}),
  ...(category ? { category } : {}),
  ...(flags?.includes("name") ? { nameOnly: true } : {}),
  ...(flags?.includes("stage") ? { stage: true } : {}),
}));

type UrlParts = { host: string; path: string };

/** Delar upp en länk i värd och path (utan avslutande slash). */
const urlParts = (value: string | undefined): UrlParts | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      host: url.hostname.replace(/^www\./i, "").toLowerCase(),
      path: url.pathname.replace(/\/+$/, "").toLowerCase(),
    };
  } catch {
    return null;
  }
};

/**
 * Värdar som samlar många olika arrangörer (sociala medier, listtjänster,
 * stadsguider). De får aldrig matcha hela sajten – bara sin exakta path.
 */
const AGGREGATOR_HOSTS = new Set([
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "eventbrite.com",
  "loppistajm.se",
  "visitstockholm.se",
]);

/** Värden och dess föräldradomäner, mest specifik först. */
const hostAndParents = (host: string): string[] => {
  const parts = host.split(".");
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join("."));
  return out;
};

/** Värd → de poster som räknas som kuraterade ("" = hela sajten). */
const CURATED_BY_HOST = (() => {
  const index = new Map<string, { path: string; venue: CuratedVenue }[]>();
  for (const venue of CURATED_VENUES) {
    if (venue.nameOnly) continue;
    const parts = urlParts(venue.url);
    if (!parts) continue;
    const bucket = index.get(parts.host);
    if (bucket) bucket.push({ path: parts.path, venue });
    else index.set(parts.host, [{ path: parts.path, venue }]);
  }
  return index;
})();

/** Antal olika ställen per värd – delade domäner får inte kategorisera. */
const CURATED_VENUES_PER_HOST = (() => {
  const counts = new Map<string, number>();
  for (const venue of CURATED_VENUES) {
    const parts = urlParts(venue.url);
    if (!parts) continue;
    counts.set(parts.host, (counts.get(parts.host) ?? 0) + 1);
  }
  return counts;
})();

const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9åäö']+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Enordsnamn per värd. Används bara när en delad domän redan pekat ut värden:
 * då är det säkert att låta titeln avgöra vilket av ställena det gäller.
 */
const CURATED_SINGLE_WORDS_BY_HOST = (() => {
  const index = new Map<string, Map<string, CuratedVenue>>();
  for (const venue of CURATED_VENUES) {
    const name = normalizeName(venue.name);
    if (name.includes(" ")) continue;
    const parts = urlParts(venue.url);
    if (!parts) continue;
    const bucket = index.get(parts.host) ?? new Map<string, CuratedVenue>();
    bucket.set(name, venue);
    index.set(parts.host, bucket);
  }
  return index;
})();

/** Normaliserat namn → post, så kategori och markering delar samma uppslag. */
const CURATED_BY_NAME = new Map(
  CURATED_VENUES.map((venue) => [normalizeName(venue.name), venue] as const),
);

/** Normaliserade namn, för att matcha API-titlar mot listan. */
const CURATED_NAMES = new Set(CURATED_BY_NAME.keys());

/**
 * Namnen indexerade på sitt första ord. På så sätt räcker det med en
 * uppslagning per ord i eventtiteln i stället för att gå igenom hela listan
 * för varje event. Skalan blir O(ord) i stället för O(listan).
 * Enstaka ord ("Berns", "Camping") matchas bara exakt och indexeras därför inte.
 */
const CURATED_BY_HEAD = (() => {
  const index = new Map<string, string[]>();
  for (const name of CURATED_NAMES) {
    if (!name.includes(" ")) continue;
    const head = name.split(" ")[0] ?? "";
    if (head.length < 4) continue;
    const bucket = index.get(head);
    if (bucket) bucket.push(name);
    else index.set(head, [name]);
  }
  return index;
})();

/** Event som hämtats automatiskt från en extern källa (visit-*). */
export const isApiEvent = (event: Pick<EventItem, "organizerId">): boolean =>
  event.organizerId.startsWith("visit-");

type CuratedMatch = {
  venue: CuratedVenue;
  /** Bara en entydig träff får bidra med kategori. */
  exact: boolean;
};

/**
 * Slår upp den kuraterade posten bakom ett event. Både gråmarkeringen och
 * kategoriseringen går via den här, så de kan aldrig tycka olika om ett ställe.
 */
type CuratedTarget = Pick<EventItem, "name" | "sourceUrl"> & { place?: string | undefined };

function findCurated(event: CuratedTarget): CuratedMatch | undefined {
  const target = urlParts(event.sourceUrl);
  // Delad domän: markeringen gäller, men kategorin måste komma från namnet.
  let ambiguous: CuratedMatch | undefined;
  let ambiguousHost: string | undefined;
  if (target) {
    for (const host of hostAndParents(target.host)) {
      const entries = CURATED_BY_HOST.get(host);
      if (!entries) continue;
      // En specifik path vinner alltid över en post för hela sajten.
      const specific = entries.find(
        ({ path, venue }) =>
          path &&
          (target.path === path || target.path.startsWith(`${path}/`)) &&
          !isArena(venue) &&
          !isStage(venue),
      );
      if (specific) return { venue: specific.venue, exact: true };

      const root = entries.find(({ path }) => !path);
      if (!root || AGGREGATOR_HOSTS.has(host) || isArena(root.venue) || isStage(root.venue)) {
        continue;
      }
      if ((CURATED_VENUES_PER_HOST.get(host) ?? 0) > 1) {
        // stockholm.se och kungligaslotten.se hyser många ställen. Spara träffen
        // som reserv och låt namnsteget avgöra vilket ställe eventet hör till.
        if (!ambiguous) {
          ambiguous = { venue: root.venue, exact: false };
          ambiguousHost = host;
        }
        continue;
      }
      return { venue: root.venue, exact: true };
    }
  }

  // Titeln räknas först, därefter platsen. Många API-event heter något annat
  // än stället de spelas på ("BARNVAGNSTORSDAG" på Paradox Museum). Scener får
  // dock bara fast status via titeln – en kväll på Debaser Strand är en
  // tillfällig spelning, inte ett fast ställe.
  const byTitle = matchCuratedName(normalizeName(event.name));
  if (byTitle && !isArena(byTitle)) return { venue: byTitle, exact: true };

  let onStage = false;
  const byPlace = matchCuratedName(normalizeName(event.place ?? ""));
  if (byPlace && !isArena(byPlace)) {
    if (!isStage(byPlace)) return { venue: byPlace, exact: true };
    // Scenens lokal: då ska inte heller en delad värds reservträff gälla.
    onStage = true;
  }

  // Eventet äger rum på en scen: då räcker det inte att titeln nämner ett
  // annat ställe på samma sajt (t.ex. "Julbord på Långholmen" på värdshuset).
  if (onStage) return undefined;

  // Enordsnamn matchas bara när en delad domän redan pekat ut värden, så att
  // "Camping" eller "Berns" inte fastnar i vilken text som helst.
  const onHost = ambiguousHost ? CURATED_SINGLE_WORDS_BY_HOST.get(ambiguousHost) : undefined;
  if (onHost) {
    for (const [text, fromPlace] of [
      [event.name, false],
      [event.place, true],
    ] as const) {
      for (const word of normalizeName(text ?? "").split(" ")) {
        const venue = onHost.get(word);
        if (!venue || isArena(venue)) continue;
        if (fromPlace && isStage(venue)) continue;
        return { venue, exact: true };
      }
    }
  }

  // Ingen träff: markera eventet som kuraterat, men utan kategori.
  return ambiguous;
}

/**
 * Arenor och arenascener. Deras program är tillfälliga shower, så de får inte
 * göra ett event fast bara för att det spelas där. De ligger kvar i listan för
 * dokumentationen, men undantas från all matchning.
 */
const ARENAS = new Set(["avicii arena", "tele2 arena", "3arena", "strawberry arena"]);

const isArena = (venue: CuratedVenue | undefined): boolean =>
  venue ? ARENAS.has(normalizeName(venue.name)) : false;

/**
 * Scener blir bara fasta via titeln. Varken platsen eller arrangörens egen
 * länk får räcka – en kväll på scenen är en tillfällig spelning. Flaggan sätts
 * per post i listan.
 */
const isStage = (venue: CuratedVenue | undefined): boolean => venue?.stage === true;

/**
 * Matchar en normaliserad titel eller plats mot listan. Enstaka ord kräver
 * exakt träff; flerordsnamn får inleda eller förekomma som hel fras.
 */
function matchCuratedName(text: string): CuratedVenue | undefined {
  if (!text) return undefined;
  const exact = CURATED_BY_NAME.get(text);
  if (exact) return exact;

  // Enstaka ord är för generiska för att matchas inuti en längre text.
  if (!text.includes(" ")) return undefined;

  let offset = 0;
  for (const word of text.split(" ")) {
    const candidates = CURATED_BY_HEAD.get(word);
    if (candidates) {
      for (const curated of candidates) {
        if (!text.startsWith(curated, offset)) continue;
        const after = text[offset + curated.length];
        if (after !== undefined && after !== " ") continue;
        if (offset === 0 || curated.length >= 6) return CURATED_BY_NAME.get(curated);
      }
    }
    offset += word.length + 1;
  }
  return undefined;
}

/**
 * Event som finns på den manuella listan – matchat på länk, titel eller plats.
 * De ska aldrig få den grå markeringen, även om de kom in via API:t.
 */
export function isCuratedEvent(event: CuratedTarget): boolean {
  return findCurated(event) !== undefined;
}

/**
 * Kategorin från den manuella listan. Kräver en entydig träff: exakt path,
 * unik värd eller namnmatchning – aldrig en gissning på en delad domän.
 */
export const curatedCategoryFor = (event: CuratedTarget): CategoryId | undefined => {
  const match = findCurated(event);
  return match?.exact ? match.venue.category : undefined;
};

/**
 * Stämplar eventet med sin källa när datat läses in, så att renderingen slipper
 * räkna om matchningen för varje kort och filterbyte. Stämpeln räknas om vid
 * varje inläsning, så att gamla cache-poster följer dagens regler.
 */
export function withFeedSource<T extends EventItem>(event: T): T {
  if (!isApiEvent(event)) {
    return event.feedSource === "app" ? event : { ...event, feedSource: "app" };
  }
  // Stämpeln räknas om varje gång datat läses in. Då fångas även äldre
  // cache-poster upp när listan eller matchningsreglerna ändrats.
  const next = isCuratedEvent(event) ? "curated" : "api";
  return event.feedSource === next ? event : { ...event, feedSource: next };
}

/**
 * Tillfälligt API-event: automatiskt hämtat och inte kuraterat. Läser stämpeln
 * när den finns; faller tillbaka på matchning för äldre cachade event.
 */
export const isTemporaryEvent = (
  event: Pick<EventItem, "name" | "sourceUrl" | "organizerId" | "feedSource"> & {
    place?: string | undefined;
  },
) => (event.feedSource ? event.feedSource === "api" : isApiEvent(event) && !isCuratedEvent(event));

export type SourceTab = "fasta" | "event" | "bada";

export const SOURCE_TABS: { id: SourceTab; label: string }[] = [
  { id: "fasta", label: "Fasta" },
  { id: "event", label: "Event" },
  { id: "bada", label: "Båda" },
];

/** Samma filtrering på mobil och desktop. */
export function matchesSourceTab(
  event: Pick<EventItem, "name" | "sourceUrl" | "organizerId" | "feedSource"> & {
    place?: string | undefined;
  },
  tab: SourceTab,
): boolean {
  if (tab === "bada") return true;
  return tab === "event" ? isTemporaryEvent(event) : !isTemporaryEvent(event);
}
