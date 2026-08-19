import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";
import { TIERS, TRIAL_DAYS } from "@/lib/access";

/**
 * Skyltfönstret.
 *
 * Fram tills nu var hela den publika ytan en inloggningsruta, alltså mötte den
 * som hittade hit ett fält för mejladress utan en rad om vad hon skulle logga
 * in på. Ett verktyg som ingen kan läsa sig till vad det gör säljer noll
 * exemplar hur bra det än är byggt.
 *
 * Sidan säger bara sådant appen faktiskt gör. Ett löfte här som inte håller i
 * appen kostar mer än den kund det lockade in, eftersom hon säger upp sig och
 * berättar varför för alla andra i samma bransch.
 */

const LACKOR = [
  {
    ikon: "hourglass_disabled",
    rubrik: "Licensen tog slut i mars, annonsen rullade till oktober",
    text: "Tolv månader låter länge när du skriver på, och sedan går det ett år utan att någon säger till. Ett uppdrag på 12 000 kronor där varumärket fortsätter i ett halvår till är 6 000 kronor som aldrig fakturerades, och du märkte det inte ens.",
  },
  {
    ikon: "block",
    rubrik: "Exklusiviteten du glömt att du lovat",
    text: "Du lovade att inte jobba med konkurrerande hudvård på sex månader, och i månad fyra kommer en förfrågan som du hinner tacka ja till innan du kommer på det. Piches säger ifrån medan du fortfarande kan svara nej.",
  },
  {
    ikon: "trending_down",
    rubrik: "Uppdraget som såg störst ut var det du tjänade minst på",
    text: "Fyra timmars inspelning, tre omtagningar och allt mejlande blir lätt fyrtio timmar, och då är 8 000 kronor exakt 200 kronor i timmen. Det syns aldrig så länge du bara ser summan på fakturan.",
  },
];

const STEG = [
  {
    ikon: "mark_email_unread",
    rubrik: "Förfrågan kommer in",
    text: "Klistra in mejlet från varumärket, så plockas plattform, antal filmer, användningstid och exklusivitet isär åt dig.",
  },
  {
    ikon: "calculate",
    rubrik: "Priset räknas på rättigheterna",
    text: "Vad du får betalt beror på hur länge och hur brett de får använda materialet, inte på hur lång filmen råkade bli.",
  },
  {
    ikon: "local_shipping",
    rubrik: "Du levererar och klockan startar",
    text: "Licensen börjar löpa den dag materialet går iväg, inte den dag du råkade skriva in det i appen.",
  },
  {
    ikon: "notifications_active",
    rubrik: "Radarn säger till i god tid",
    text: "Långt innan licensen går ut, medan det fortfarande är ett samtal om förlängning och inte en påminnelse i efterhand.",
  },
  {
    ikon: "autorenew",
    rubrik: "Du fakturerar förlängningen",
    text: "Eller släpper materialet vidare till någon annan, om ingen längre har rätten till det.",
  },
];

const MOTORN = [
  {
    ikon: "gavel",
    rubrik: "Utgångsradar",
    text: "Varje licens har ett slutdatum och en påminnelse som kommer medan det fortfarande finns tid att göra något åt det.",
  },
  {
    ikon: "shield",
    rubrik: "Exklusivitetsvakt",
    text: "Har du lovat ett varumärke ensamrätt i en kategori vet appen det, och den säger till innan du tackar ja till grannen.",
  },
  {
    ikon: "inventory_2",
    rubrik: "Lager av material som går att licensiera om",
    text: "Material vars licens löpt ut är inte förbrukat, det är något du kan sälja en gång till, och det syns i en lista i stället för i minnet.",
  },
  {
    ikon: "receipt_long",
    rubrik: "Fakturaunderlag med svensk moms",
    text: "Produktion och licens som egna rader, med momsen uträknad, så att bokföringen inte blir en kväll i efterhand.",
  },
  {
    ikon: "trending_up",
    rubrik: "Lönsamhet i kronor, inte i känsla",
    text: "Var pengarna läcker, vad du faktiskt får per timme och hur många uppdrag som återstår till månadens mål.",
  },
  {
    ikon: "shopping_bag",
    rubrik: "Digitala produkter",
    text: "Räkna på en mall, en guide eller en kurs innan du bygger den, så att du vet vad den behöver sälja för att vara värd tiden.",
  },
];

const FRAGOR = [
  {
    fraga: "Behöver jag ett kort för att prova?",
    svar: `Nej. Provperioden är ${TRIAL_DAYS} dagar, den kräver ingen kortuppgift och den övergår inte i något betalt av sig själv. Vill du fortsätta väljer du nivå inne i appen när du är redo.`,
  },
  {
    fraga: "Vem kan se mina uppdrag och mina priser?",
    svar: "Bara du. Varje rad är låst till ditt konto på databasnivå, alltså inte bara i gränssnittet, och ingen annan användare kommer åt dem ens om hon försöker.",
  },
  {
    fraga: "Vad händer med allt om jag säger upp?",
    svar: "Du behåller tillgången perioden ut och materialet ligger kvar orört efteråt. Kommer du tillbaka finns dina uppdrag och licenser kvar där de låg.",
  },
  {
    fraga: "Funkar det om jag är ny och bara har några uppdrag?",
    svar: "Ja, och det är egentligen då det är enklast, eftersom du slipper skriva in ett halvår gamla avtal i efterhand. Prisräknaren är dessutom som mest värd något innan du hunnit vänja dig vid att säga en siffra på känsla.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 md:px-8">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-headline-sm tracking-tight text-primary">Piches</span>
        </div>
        <Link
          to="/logga-in"
          className="rounded-full border border-outline-variant/60 px-4 py-2 text-label-caps uppercase text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Logga in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 md:px-8">
        <section className="pb-16 pt-8 md:pb-24 md:pt-14">
          <p className="text-label-caps uppercase text-primary">För dig som gör UGC</p>
          <h1 className="mt-4 max-w-3xl text-[34px] font-bold leading-[1.15] tracking-tight text-on-surface md:text-[52px]">
            Du vet vad du fick betalt. Vet du hur länge de får använda det?
          </h1>
          <p className="mt-6 max-w-2xl text-body-lg text-on-surface-variant">
            Ett UGC-uppdrag är egentligen en licens med en klocka i, och det är den klockan som
            avgör om du får betalt en gång eller varje gång materialet används vidare, men den
            finns nästan aldrig någon annanstans än i en gammal mejltråd. Piches håller reda på
            den åt dig, från första förfrågan till den dag rättigheten går ut.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/logga-in"
              className="rounded-full bg-primary px-7 py-3.5 text-label-caps uppercase text-on-primary transition-transform hover:scale-[1.02] active:scale-95"
            >
              Prova {TRIAL_DAYS} dagar gratis
            </Link>
            <p className="text-body-md text-on-surface-variant">
              Inget kort, ingen bindning, uppsägning när du vill.
            </p>
          </div>
        </section>

        <Avsnitt
          etikett="Vad det kostar att inte veta"
          rubrik="Tre läckor som ingen skickar en påminnelse om"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {LACKOR.map((l) => (
              <article
                key={l.rubrik}
                className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6"
              >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-error-container text-on-error-container">
                  <Icon name={l.ikon} size={22} />
                </div>
                <h3 className="mt-4 text-headline-sm text-on-surface">{l.rubrik}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{l.text}</p>
              </article>
            ))}
          </div>
        </Avsnitt>

        <Avsnitt etikett="Så funkar det" rubrik="Ett uppdrag, hela vägen runt">
          <ol className="space-y-4">
            {STEG.map((s, i) => (
              <li
                key={s.rubrik}
                className="flex flex-wrap items-start gap-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 md:flex-nowrap"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-container font-mono text-mono-data text-on-primary-container">
                  {i + 1}
                </span>
                <div className="min-w-[240px] flex-1">
                  <h3 className="text-headline-sm text-on-surface">{s.rubrik}</h3>
                  <p className="mt-1 text-body-md text-on-surface-variant">{s.text}</p>
                </div>
                <Icon name={s.ikon} size={22} className="mt-2 shrink-0 text-on-surface-variant" />
              </li>
            ))}
          </ol>
        </Avsnitt>

        <Avsnitt
          etikett="Rättighetsmotorn"
          rubrik="Det andra verktyg inte gör"
          ingress="Kalendrar påminner om möten och bokföringsprogram räknar moms, men ingen av dem vet att ett varumärkes rätt att använda din film tar slut den fjortonde mars."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MOTORN.map((m) => (
              <article
                key={m.rubrik}
                className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6"
              >
                <Icon name={m.ikon} size={24} className="text-primary" />
                <h3 className="mt-3 text-headline-sm text-on-surface">{m.rubrik}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{m.text}</p>
              </article>
            ))}
          </div>
        </Avsnitt>

        <Avsnitt
          etikett="Pris"
          rubrik={`${TRIAL_DAYS} dagar gratis, sedan väljer du nivå`}
          ingress="En enda licens som hinner löpa ut obemärkt kostar oftast mer än ett helt år av verktyget."
        >
          <div className="grid gap-5 md:grid-cols-2">
            {TIERS.map((plan) => (
              <article
                key={plan.tier}
                className="flex flex-col rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-7"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-headline-md text-on-surface">{plan.label}</h3>
                  <p className="font-mono text-headline-md text-primary">{plan.priceSek} kr</p>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">per månad, exklusive moms</p>
                <p className="mt-4 text-body-md text-on-surface-variant">{plan.fits}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.includes.map((rad) => (
                    <li key={rad} className="flex items-start gap-2.5 text-body-md text-on-surface">
                      <Icon name="check" size={17} className="mt-0.5 shrink-0 text-primary" />
                      {rad}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/logga-in"
                  className="mt-7 rounded-full bg-primary px-6 py-3 text-center text-label-caps uppercase text-on-primary transition-transform hover:scale-[1.02] active:scale-95"
                >
                  Börja med {plan.label}
                </Link>
              </article>
            ))}
          </div>
        </Avsnitt>

        <Avsnitt etikett="Frågor" rubrik="Det du undrar innan du provar">
          <div className="space-y-4">
            {FRAGOR.map((f) => (
              <article
                key={f.fraga}
                className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6"
              >
                <h3 className="text-headline-sm text-on-surface">{f.fraga}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{f.svar}</p>
              </article>
            ))}
          </div>
        </Avsnitt>

        <section className="mt-20 rounded-3xl bg-primary-container px-7 py-14 text-center md:px-14">
          <h2 className="mx-auto max-w-2xl text-headline-lg text-on-primary-container">
            Lägg in ditt senaste uppdrag och se när licensen tar slut
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-body-lg text-on-primary-container">
            Det tar några minuter, det kostar ingenting på {TRIAL_DAYS} dagar och du behöver inte
            lämna någon kortuppgift för att komma igång.
          </p>
          <Link
            to="/logga-in"
            className="mt-8 inline-block rounded-full bg-primary px-8 py-4 text-label-caps uppercase text-on-primary transition-transform hover:scale-[1.02] active:scale-95"
          >
            Skapa konto
          </Link>
        </section>
      </main>

      <footer className="border-t border-outline-variant/40">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 md:px-8">
          <p className="text-body-md text-on-surface-variant">
            Piches, byggt i Sverige för svenska kreatörer.
          </p>
          <a
            href="mailto:info@essensiadesign.se"
            className="text-body-md text-on-surface-variant underline transition-colors hover:text-on-surface"
          >
            info@essensiadesign.se
          </a>
        </div>
      </footer>
    </div>
  );
}

function Avsnitt({
  etikett,
  rubrik,
  ingress,
  children,
}: {
  etikett: string;
  rubrik: string;
  ingress?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-outline-variant/40 py-14 md:py-20">
      <p className="text-label-caps uppercase text-primary">{etikett}</p>
      <h2 className="mt-3 max-w-3xl text-headline-lg text-on-surface md:text-[36px]">{rubrik}</h2>
      {ingress && <p className="mt-4 max-w-2xl text-body-lg text-on-surface-variant">{ingress}</p>}
      <div className="mt-9">{children}</div>
    </section>
  );
}
