import type { Product, ProductKind, Settings } from "@/types/db";

/**
 * Produktmotorn.
 *
 * Ett UGC-uppdrag betalas en gång. En digital produkt betalas varje gång någon
 * köper den, och den skillnaden är hela skälet att bygga en. Men den räkningen
 * görs nästan aldrig ordentligt, eftersom byggtiden känns gratis medan man
 * lägger den och först i efterhand visar sig ha kostat två månaders uppdrag.
 *
 * Motorn räknar därför alltid tre saker samtidigt: vad produkten drar in, vad
 * den kostade i tid, och vad samma tid hade gett som vanliga uppdrag. Det sista
 * är det som avgör om den var värd att bygga.
 *
 * Siffrorna nedan är startvärden från vad som är vanligt i branschen, inte
 * sanningar. Så fort du har egna utfall ska de ersätta gissningen.
 */

export type ProductTemplate = {
  kind: ProductKind;
  label: string;
  /** Vad det brukar ta att bygga, i timmar. */
  buildHours: [number, number];
  /** Prisspann som brukar fungera på svensk marknad. */
  price: [number, number];
  monthlyHours: number;
  /**
   * Timmar per såld enhet. Avgörande för allt som levereras personligen:
   * utan den påstod motorn att rådgivning gav 101 000 kronor i timmen, för
   * att de 180 leveranstimmarna inte fanns i modellen.
   */
  hoursPerUnit: number;
  recurring: boolean;
  /** Varför den här formen passar, och vad den kräver. */
  fits: string;
};

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    kind: "mall",
    label: "Mall eller presetpaket",
    buildHours: [5, 15],
    price: [149, 599],
    monthlyHours: 0,
    hoursPerUnit: 0,
    recurring: false,
    fits: "Snabbast att bygga och kräver ingen support. Bra första produkt, eftersom du får testa om publiken köper något alls innan du lägger veckor på något stort.",
  },
  {
    kind: "guide",
    label: "Guide eller e-bok",
    buildHours: [15, 40],
    price: [199, 899],
    monthlyHours: 0,
    hoursPerUnit: 0,
    recurring: false,
    fits: "Passar när du får samma fråga om och om igen. Skriv ner svaret en gång och sälj det i stället för att svara i DM.",
  },
  {
    kind: "minikurs",
    label: "Minikurs",
    buildHours: [30, 60],
    price: [995, 2995],
    monthlyHours: 2,
    hoursPerUnit: 0,
    recurring: false,
    fits: "Ett avgränsat resultat, till exempel att komma igång med UGC. Kortare än en kurs och därför både snabbare att bygga och lättare att sälja.",
  },
  {
    kind: "kurs",
    label: "Fullständig kurs",
    buildHours: [80, 200],
    price: [2995, 12995],
    monthlyHours: 5,
    hoursPerUnit: 0,
    recurring: false,
    fits: "Störst intäkt per köpare, men också störst risk. Bygg den först när du har sålt något mindre till samma publik och vet att de köper.",
  },
  {
    kind: "medlemskap",
    label: "Medlemskap",
    buildHours: [40, 100],
    price: [199, 599],
    monthlyHours: 12,
    hoursPerUnit: 0,
    recurring: true,
    fits: "Ger förutsägbar intäkt varje månad, men kräver att du levererar något nytt löpande. Räkna med att en del faller ifrån varje månad.",
  },
  {
    kind: "workshop",
    label: "Workshop eller webbinarium",
    buildHours: [10, 25],
    price: [495, 2495],
    monthlyHours: 0,
    // Sjalva genomforandet, en gang per tillfalle.
    hoursPerUnit: 0.2,
    recurring: false,
    fits: "Går att sälja innan den är byggd, vilket gör den till det billigaste sättet att testa om ett ämne håller.",
  },
  {
    kind: "konsultation",
    label: "Rådgivning en mot en",
    buildHours: [2, 6],
    price: [995, 3500],
    monthlyHours: 0,
    // Hela leveransen ar tid. Utan den har raknade motorn 101 000 kr/h.
    hoursPerUnit: 1.5,
    recurring: false,
    fits: "Högst pris per timme men skalar inte, eftersom du fortfarande säljer tid. Bra för att ta reda på exakt vad folk behöver innan du bygger något större.",
  },
];

/** Hur stor andel som brukar köpa, beroende på hur nära publiken står dig. */
export const CONVERSION_BENCHMARKS = [
  { label: "Kall publik som aldrig hört av dig", pct: 0.5 },
  { label: "Följare som ser dig regelbundet", pct: 1.5 },
  { label: "Mejllista", pct: 3 },
  { label: "Lista under en lansering", pct: 7 },
];

export type ProductForecast = {
  /** Antal köpare uppskattningen bygger på. */
  buyers: number;
  /** Intäkt över perioden, före kostnader. */
  revenue: number;
  costs: number;
  /** Kvar efter kostnader, före skatt. */
  net: number;
  hours: number;
  /** Vad produkten gav dig per nedlagd timme. */
  hourlyRate: number | null;
  /**
   * Antal som krävs för att täcka allt, inklusive din tid. För löpande
   * produkter är enheten medlemsmånader, inte medlemmar.
   */
  breakEvenUnits: number | null;
  /** Vad samma byggtid hade gett som vanliga uppdrag, i kronor. */
  opportunityCostSek: number | null;
  /** Slår produkten din vanliga timpenning? */
  beatsFreelance: boolean | null;
  months: number;
};

export type ForecastInput = {
  price: number;
  buildHours: number;
  monthlyHours: number;
  buildCost: number;
  monthlyCost: number;
  conversionPct: number;
  recurring: boolean;
  /** Publiken produkten säljs till. */
  audience: number;
  /** Andel som lämnar per månad, för löpande produkter. */
  monthlyChurnPct?: number;
  /** Timmar per såld enhet, för det som levereras personligen. */
  hoursPerUnit?: number;
};

/**
 * Räknar fram utfallet över en period. Tolv månader är förvalet eftersom en
 * produkt som inte bär sig på ett år sällan bär sig alls, och för att det är
 * ungefär så länge materialet håller innan det behöver göras om.
 */
export function forecastProduct(
  input: ForecastInput,
  settings: Settings,
  actualHourly: number | null,
  months = 12,
): ProductForecast {
  const buyers = Math.round((input.audience * input.conversionPct) / 100);

  let revenue: number;
  if (input.recurring) {
    // Loparande intakt med avhopp. Varje manad tappar du en andel av dem som
    // fanns, och att rakna utan det ger en siffra som aldrig intraffar.
    const churn = (input.monthlyChurnPct ?? 8) / 100;
    let kvar = buyers;
    revenue = 0;
    for (let m = 0; m < months; m++) {
      revenue += kvar * input.price;
      kvar = kvar * (1 - churn);
    }
  } else {
    revenue = buyers * input.price;
  }

  const costs = input.buildCost + input.monthlyCost * months;
  const net = revenue - costs;
  const hours =
    input.buildHours + input.monthlyHours * months + (input.hoursPerUnit ?? 0) * buyers;

  const hourlyRate = hours > 0 ? net / hours : null;

  // Nollpunkten raknar in din egen tid till maltimpenningen, inte bara
  // utlagg. Annars ser en produkt som atgick tre veckor ut som gratis.
  // Jamforelsetimpenningen satts forst, sa att nollpunkten och
  // alternativkostnaden prissatter samma timme till samma belopp. Negativ
  // timpenning (en affar dar inkopen sprack) far aldrig bli jamforelse,
  // annars slar varje tankbar produkt "dina uppdrag".
  const jamforelseTimpenning =
    actualHourly !== null && actualHourly > 0 ? actualHourly : settings.target_hourly_rate;

  // Nollpunkten raknar in ALL egen tid och alla lopande kostnader, inte bara
  // bygget. For en lopande produkt ar enheten dessutom manader, inte kunder.
  const egenTidsKostnad = hours * jamforelseTimpenning;
  const totalKostnad = costs + egenTidsKostnad;
  const breakEvenUnits = input.price > 0 ? Math.ceil(totalKostnad / input.price) : null;

  const opportunityCostSek =
    jamforelseTimpenning > 0 ? input.buildHours * jamforelseTimpenning : null;
  return {
    buyers,
    revenue,
    costs,
    net,
    hours,
    hourlyRate,
    breakEvenUnits,
    opportunityCostSek,
    beatsFreelance: hourlyRate === null ? null : hourlyRate > jamforelseTimpenning,
    months,
  };
}

export function forecastFromProduct(
  product: Product,
  settings: Settings,
  actualHourly: number | null,
  months = 12,
): ProductForecast {
  const audience = Math.max(settings.audience_size, settings.email_list_size);
  return forecastProduct(
    {
      price: product.price_sek,
      buildHours: product.build_hours,
      monthlyHours: product.monthly_hours,
      buildCost: product.build_cost_sek,
      monthlyCost: product.monthly_cost_sek,
      conversionPct: product.conversion_pct,
      recurring: product.recurring,
      audience,
    },
    settings,
    actualHourly,
    months,
  );
}

/**
 * Vad som är värt att bygga härnäst, rangordnat. Bäst först betyder högst
 * timpenning, eftersom det är det enda måttet som väger in att en produkt som
 * drar in mer men tar fyra gånger så lång tid är en sämre affär.
 */
export type ProductSuggestion = {
  template: ProductTemplate;
  forecast: ProductForecast;
  /** Priset mitt i spannet, som utgångspunkt. */
  suggestedPrice: number;
  reason: string;
};

export function suggestProducts(
  settings: Settings,
  actualHourly: number | null,
  conversionPct?: number,
): ProductSuggestion[] {
  const audience = Math.max(settings.audience_size, settings.email_list_size);
  if (audience <= 0) return [];

  // Star publiken pa en lista konverterar den battre an ett floede.
  const konvertering =
    conversionPct ??
    (settings.email_list_size >= settings.audience_size && settings.email_list_size > 0 ? 3 : 1.5);

  return PRODUCT_TEMPLATES.map((t) => {
    const price = Math.round((t.price[0] + t.price[1]) / 2);
    const buildHours = Math.round((t.buildHours[0] + t.buildHours[1]) / 2);
    const forecast = forecastProduct(
      {
        price,
        buildHours,
        monthlyHours: t.monthlyHours,
        hoursPerUnit: t.hoursPerUnit,
        buildCost: 0,
        monthlyCost: 0,
        conversionPct: konvertering,
        recurring: t.recurring,
        audience,
      },
      settings,
      actualHourly,
    );
    return {
      template: t,
      forecast,
      suggestedPrice: price,
      reason: t.fits,
    };
  }).sort((a, b) => (b.forecast.hourlyRate ?? 0) - (a.forecast.hourlyRate ?? 0));
}
