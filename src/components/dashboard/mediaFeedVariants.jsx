// Template pools for the Airline Media Feed. Each variant is a function that
// receives a context object and returns { source, handle, headline, description }.
// A seeded hash picks the variant so stories rotate per event and per day
// instead of always following the same schema.

export const hashString = (str) => {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const pickVariant = (seedStr, arr) => arr[hashString(seedStr) % arr.length];

export const FLIGHT_VARIANTS = [
  (c) => ({
    source: 'Ops Wire', handle: '@opswire',
    headline: c.lang === 'de' ? `${c.airlineName} beendet ${c.route} mit Score ${c.score}` : `${c.airlineName} closes ${c.route} with score ${c.score}`,
    description: c.lang === 'de'
      ? `${c.score >= 85 ? 'Am Ankunftsgate wirkte der Umlauf fast routiniert: kurze Wege, ruhige Ansagen, gelassene Crew.' : c.score < 65 ? 'Nach dem Aussteigen war die Stimmung gedämpft – die Ops-Leitung bereitet die Sequenz bereits nach.' : 'Der Flug kam ordentlich durch den Tag, ohne Schlagzeile, aber mit Momenten, die Stammgäste bemerken.'} ${c.landingLine}`
      : `${c.score >= 85 ? 'At the arrival gate the rotation felt quietly well run: calm announcements, composed crew.' : c.score < 65 ? 'After deboarding the mood was muted while operations reviewed the sequence.' : 'The flight got through the day cleanly, with small details frequent flyers notice.'} ${c.landingLine}`,
  }),
  (c) => ({
    source: 'Cockpit Chronicle', handle: '@cockpitchronicle',
    headline: c.lang === 'de' ? `Funkverkehr auf ${c.route}: So klang der letzte Umlauf von ${c.airlineName}` : `Radio chatter on ${c.route}: how ${c.airlineName}'s last rotation sounded`,
    description: c.lang === 'de'
      ? `${c.score >= 85 ? `Ein Fluglotse beschrieb den Anflug als "Lehrbuch" – knappe Readbacks, stabile Geschwindigkeit im Endanflug.` : c.score < 65 ? 'Im Tower-Log tauchen mehrere Korrekturen auf; die Crew musste im Endanflug nacharbeiten.' : 'Nichts Auffälliges im Funk, aber ein paar interessante Details in der Rollführung.'} ${c.landingLine}`
      : `${c.score >= 85 ? 'A controller described the approach as "textbook" – crisp readbacks, stable speed on final.' : c.score < 65 ? 'Tower logs show several corrections; the crew had to work the final approach.' : 'Nothing unusual on frequency, but a few interesting details in taxi routing.'} ${c.landingLine}`,
  }),
  (c) => ({
    source: 'Ramp Report', handle: '@rampreport',
    headline: c.lang === 'de' ? `Vom Vorfeld beobachtet: ${c.airlineName} auf ${c.route}` : `Seen from the ramp: ${c.airlineName} on ${c.route}`,
    description: c.lang === 'de'
      ? `${c.score >= 85 ? 'Die Bodencrew sprach von einem der saubersten Turnarounds der Woche – Blöcke raus, Türen zu, alles im Takt.' : c.score < 65 ? 'Auf dem Vorfeld wurde getuschelt: Der Umlauf wirkte hektisch, und die Nachbereitung läuft.' : 'Ein unauffälliger, solider Umlauf – genau die Sorte, die Dispatcher mögen.'} Score: ${c.score}. ${c.landingLine}`
      : `${c.score >= 85 ? 'Ground crew called it one of the cleanest turnarounds of the week – chocks out, doors closed, all on beat.' : c.score < 65 ? 'Ramp whispers: the rotation looked rushed and a debrief is underway.' : 'An unremarkable, solid rotation – exactly the kind dispatchers like.'} Score: ${c.score}. ${c.landingLine}`,
  }),
  (c) => ({
    source: 'Approach Insider', handle: '@approachinsider',
    headline: c.lang === 'de'
      ? (c.score >= 85 ? `Analyse: Warum der ${c.route}-Flug von ${c.airlineName} so glatt lief` : c.score < 65 ? `Analyse: Was auf ${c.route} bei ${c.airlineName} schieflief` : `Fluganalyse ${c.route}: Solide Arbeit bei ${c.airlineName}`)
      : (c.score >= 85 ? `Analysis: why ${c.airlineName}'s ${c.route} leg went so smoothly` : c.score < 65 ? `Analysis: what went wrong on ${c.airlineName}'s ${c.route} leg` : `Flight analysis ${c.route}: solid work at ${c.airlineName}`),
    description: c.lang === 'de'
      ? `Unser Datenteam hat den Flug seziert: Gesamtscore ${c.score}. ${c.landingLine} ${c.score >= 85 ? 'Besonders die Energiekontrolle im Sinkflug fiel positiv auf.' : c.score < 65 ? 'Die Kennzahlen legen nahe, dass das Energiemanagement der Schwachpunkt war.' : 'Die Kurven zeigen einen unspektakulären, kontrollierten Flugverlauf.'}`
      : `Our data desk dissected the flight: overall score ${c.score}. ${c.landingLine} ${c.score >= 85 ? 'Energy management in the descent stood out positively.' : c.score < 65 ? 'The metrics suggest energy management was the weak point.' : 'The traces show an unspectacular, controlled profile.'}`,
  }),
  (c) => ({
    source: 'Terminal Times', handle: '@terminaltimes',
    headline: c.lang === 'de' ? `Reisende erzählen: Der ${c.route}-Flug mit ${c.airlineName}` : `Travellers recall: the ${c.route} flight with ${c.airlineName}`,
    description: c.lang === 'de'
      ? `${c.score >= 85 ? '"Man hat gemerkt, dass da jemand fliegt, der es kann", sagte eine Passagierin am Gepäckband.' : c.score < 65 ? '"Der Anflug war... interessant", meinte ein Fluggast diplomatisch. Andere waren weniger höflich.' : 'Die meisten Passagiere zuckten mit den Schultern: angekommen, pünktlich genug, weiter geht\'s.'} ${c.landingLine}`
      : `${c.score >= 85 ? '"You could tell someone who knows their craft was flying," a passenger said at the baggage belt.' : c.score < 65 ? '"The approach was... interesting," one traveller offered diplomatically. Others were less polite.' : 'Most passengers shrugged: arrived, on time enough, moving on.'} ${c.landingLine}`,
  }),
];

export const PURCHASE_VARIANTS = [
  (c) => ({
    source: 'Fleet Desk', handle: '@fleetdesk',
    headline: c.lang === 'de' ? 'Neues Flugzeug bringt Aufbruchsstimmung in die Flotte' : 'New aircraft brings fresh energy to the fleet',
    description: c.lang === 'de'
      ? `In der Wartungshalle wurde der Kauf über ${c.amount} sofort zum Gespräch. ${c.detail} Für die Crews fühlt sich das wie ein Signal an: mehr Reichweite, mehr Pläne.`
      : `The maintenance floor started talking as soon as the ${c.amount} purchase posted. ${c.detail} For crews it feels like a signal: more reach, more plans.`,
  }),
  (c) => ({
    source: 'AeroTrade Weekly', handle: '@aerotrade',
    headline: c.lang === 'de' ? `Marktnotiz: ${c.airlineName} investiert ${c.amount} in neues Fluggerät` : `Market note: ${c.airlineName} invests ${c.amount} in new metal`,
    description: c.lang === 'de'
      ? `Händlerkreise bestätigen den Abschluss. ${c.detail} Analysten fragen sich, welche Strecken als Nächstes auf dem Plan stehen.`
      : `Trading sources confirm the deal. ${c.detail} Analysts wonder which routes come next.`,
  }),
  (c) => ({
    source: 'Hangar Talk', handle: '@hangartalk',
    headline: c.lang === 'de' ? 'Neuzugang rollt zum ersten Mal in den Hangar' : 'New arrival rolls into the hangar for the first time',
    description: c.lang === 'de'
      ? `Die Techniker haben schon Wetten laufen, wer den Erstflug bekommt. Kaufpreis: ${c.amount}. ${c.detail}`
      : `The engineers already have bets running on who gets the first flight. Purchase price: ${c.amount}. ${c.detail}`,
  }),
];

export const SALE_VARIANTS = [
  (c) => ({
    source: 'Fleet Desk', handle: '@fleetdesk',
    headline: c.lang === 'de' ? 'Abschied aus der Flotte sorgt für gemischte Reaktionen' : 'Fleet departure draws mixed reactions',
    description: c.lang === 'de'
      ? `Der Abgang brachte ${c.amount} Liquidität, aber am Ramp-Fenster blieb kurz diese typische Stille, wenn ein bekannter Flieger fehlt. ${c.detail}`
      : `The move added ${c.amount} in liquidity, but there was that familiar quiet at the ramp window when a known airframe is gone. ${c.detail}`,
  }),
  (c) => ({
    source: 'AeroTrade Weekly', handle: '@aerotrade',
    headline: c.lang === 'de' ? `${c.airlineName} trennt sich von Fluggerät – ${c.amount} fließen in die Kasse` : `${c.airlineName} parts with an airframe – ${c.amount} hits the books`,
    description: c.lang === 'de'
      ? `Ob Flottenbereinigung oder Liquiditätsspritze: Der Verkauf wirft Fragen zur Strategie auf. ${c.detail}`
      : `Fleet cleanup or liquidity boost – the sale raises strategy questions. ${c.detail}`,
  }),
  (c) => ({
    source: 'Hangar Talk', handle: '@hangartalk',
    headline: c.lang === 'de' ? 'Ein Stellplatz im Hangar ist plötzlich leer' : 'A hangar bay is suddenly empty',
    description: c.lang === 'de'
      ? `Die Techniker verabschieden sich von einem alten Bekannten. Erlös: ${c.amount}. ${c.detail}`
      : `The engineers say goodbye to an old friend. Proceeds: ${c.amount}. ${c.detail}`,
  }),
];

export const LOAN_VARIANTS = [
  (c) => ({
    source: 'Banking Monitor', handle: '@banking.monitor',
    headline: c.lang === 'de' ? 'Kreditlinie erhöht den Druck im Tagesgeschäft' : 'Credit line raises pressure on the daily operation',
    description: c.lang === 'de'
      ? `${c.loanLine} Hinter den Kulissen klingt das weniger nach Drama als nach Disziplin: Jeder pünktliche Flug macht die nächste Rate glaubwürdiger.`
      : `${c.loanLine} Behind the scenes this is less drama than discipline: every punctual flight makes the next repayment more credible.`,
  }),
  (c) => ({
    source: 'Finance Radar', handle: '@financeradar',
    headline: c.lang === 'de' ? `Bilanzcheck: Wie ${c.airlineName} mit Fremdkapital arbeitet` : `Balance check: how ${c.airlineName} works with leverage`,
    description: c.lang === 'de'
      ? `${c.loanLine} Branchenkenner sehen darin kein Warnsignal – solange die Umläufe zuverlässig Geld verdienen.`
      : `${c.loanLine} Industry watchers see no red flag – as long as rotations keep earning reliably.`,
  }),
  (c) => ({
    source: 'The Ledger Post', handle: '@ledgerpost',
    headline: c.lang === 'de' ? 'Zwischen Zins und Rollfeld: Die Finanzierungsfrage' : 'Between interest and taxiway: the financing question',
    description: c.lang === 'de'
      ? `${c.loanLine} Am Ende zählt für die Bank nur eines: dass die Airline fliegt, liefert und zahlt.`
      : `${c.loanLine} In the end the bank cares about one thing: that the airline flies, delivers, and pays.`,
  }),
];

export const LOAN_PAID_VARIANTS = [
  (c) => ({
    source: 'Banking Monitor', handle: '@banking.monitor',
    headline: c.lang === 'de' ? 'Letzte Kreditrate bringt spürbare Erleichterung' : 'Final loan payment brings visible relief',
    description: c.lang === 'de'
      ? 'Die letzte Rate wurde verbucht – die Bilanz wirkt belastbarer, und die nächste Finanzierung dürfte leichter verhandelbar sein.'
      : 'The final installment has been booked – the balance sheet looks stronger and future financing should be easier to negotiate.',
  }),
  (c) => ({
    source: 'Finance Radar', handle: '@financeradar',
    headline: c.lang === 'de' ? `Schuldenfrei: ${c.airlineName} tilgt den Bankkredit vollständig` : `Debt-free: ${c.airlineName} fully repays its bank loan`,
    description: c.lang === 'de'
      ? 'Im Finance-Office soll es kurzen Applaus gegeben haben. Jetzt fließt jeder verdiente Dollar wieder in die eigene Kasse.'
      : 'Word is there was brief applause in the finance office. Every earned dollar now flows back into the airline itself.',
  }),
  (c) => ({
    source: 'The Ledger Post', handle: '@ledgerpost',
    headline: c.lang === 'de' ? 'Ein Kontoauszug, den man einrahmen möchte' : 'A bank statement worth framing',
    description: c.lang === 'de'
      ? 'Kredit vollständig getilgt. Für eine wachsende Airline ist das mehr als Buchhaltung – es ist ein Reifezeugnis.'
      : 'Loan fully repaid. For a growing airline that is more than accounting – it is a maturity certificate.',
  }),
];

export const NEWS_VARIANTS = [
  (c) => ({
    source: 'SkyNews Aviation', handle: '@skynews.av',
    headline: c.lang === 'de'
      ? (c.reputation >= 70 ? 'Redaktion sieht wachsendes Vertrauen rund um die Airline' : c.reputation <= 40 ? 'Abendbericht: Marke sucht nach einem ruhigeren nächsten Umlauf' : 'Korrespondenten hören gemischte Stimmen an den Gates')
      : (c.reputation >= 70 ? 'Aviation desk sees trust building around the airline' : c.reputation <= 40 ? 'Evening report: brand needs a calmer next rotation' : 'Correspondents hear mixed voices at the gates'),
    description: c.lang === 'de'
      ? `In den Gesprächen zwischen Gate, Crewbus und Ops-Raum entsteht ein klareres Bild von ${c.airlineName}. Haften bleibt vor allem, ob die Airline nach Stressmomenten ruhig weiterarbeitet.`
      : `In the conversations between gate, crew bus, and ops room, a clearer picture of ${c.airlineName} is forming. What sticks is whether the airline keeps working calmly after stress.`,
  }),
  (c) => ({
    source: 'Jetstream Journal', handle: '@jetstreamjournal',
    headline: c.lang === 'de'
      ? (c.reputation >= 70 ? `Kommentar: ${c.airlineName} macht gerade vieles richtig` : c.reputation <= 40 ? `Kommentar: ${c.airlineName} braucht einen Befreiungsschlag` : `Porträt einer Airline im Aufbau: ${c.airlineName}`)
      : (c.reputation >= 70 ? `Opinion: ${c.airlineName} is getting a lot right` : c.reputation <= 40 ? `Opinion: ${c.airlineName} needs a turnaround moment` : `Portrait of an airline in the making: ${c.airlineName}`),
    description: c.lang === 'de'
      ? `Reputation ist in der Luftfahrt eine Währung mit langem Gedächtnis. Aktuell steht der Kurs bei ${c.reputation}% – und jede Landung ist eine kleine Notenbank-Sitzung.`
      : `Reputation is aviation's long-memory currency. It currently trades at ${c.reputation}% – and every landing is a small central-bank meeting.`,
  }),
  (c) => ({
    source: 'Flightline Daily', handle: '@flightlinedaily',
    headline: c.lang === 'de'
      ? (c.reputation >= 70 ? 'Branchenblick: Ein Name, der öfter positiv fällt' : c.reputation <= 40 ? 'Branchenblick: Kritische Fragen im Terminal' : 'Branchenblick: Zwischen Ambition und Alltag')
      : (c.reputation >= 70 ? 'Industry watch: a name coming up positively more often' : c.reputation <= 40 ? 'Industry watch: critical questions in the terminal' : 'Industry watch: between ambition and routine'),
    description: c.lang === 'de'
      ? `Unsere Redaktion hat Bodenpersonal, Vielflieger und Dispatch befragt. Der Tenor zu ${c.airlineName}: ${c.reputation >= 70 ? 'zuverlässig, ambitioniert, im Aufwind.' : c.reputation <= 40 ? 'Potenzial vorhanden, Vertrauen noch nicht.' : 'ordentlich – aber noch ohne klare Handschrift.'}`
      : `We polled ground staff, frequent flyers, and dispatch. The verdict on ${c.airlineName}: ${c.reputation >= 70 ? 'reliable, ambitious, on the rise.' : c.reputation <= 40 ? 'potential yes, trust not yet.' : 'decent – but without a clear signature yet.'}`,
  }),
];

export const PAX_VARIANTS = [
  (c) => ({
    source: 'PaxPulse', handle: '@paxpulse',
    headline: c.lang === 'de' ? 'Passagiere beschreiben die kleinen Momente an Bord' : 'Passengers describe the small moments on board',
    description: c.hasTopFlight
      ? (c.lang === 'de' ? 'Ein Vielflieger schrieb, es habe sich nicht nach Show angefühlt, sondern nach Vertrauen: klare Ansagen, ruhige Kabine, kein Stress im Sinkflug.' : 'One frequent flyer wrote it did not feel flashy, just trustworthy: clear announcements, calm cabin, no rush in descent.')
      : (c.lang === 'de' ? 'Die Stimmen aus den Terminals bleiben vorsichtig. Viele verzeihen kleine Verspätungen, aber nicht das Gefühl, allein gelassen zu werden.' : 'Terminal voices remain cautious. Many forgive small delays, but not the feeling of being left in the dark.'),
  }),
  (c) => ({
    source: 'Cabin Voices', handle: '@cabinvoices',
    headline: c.lang === 'de' ? `Umfrage der Woche: Wie fliegt es sich mit ${c.airlineName}?` : `Poll of the week: what is flying ${c.airlineName} like?`,
    description: c.hasTopFlight
      ? (c.lang === 'de' ? 'Top-Bewertungen in den letzten Umläufen. Besonders gelobt: die Landungen. "Ich habe den Aufsetzer verpasst", schrieb ein Gast.' : 'Top ratings on recent rotations. Special praise for the landings: "I missed the touchdown," one guest wrote.')
      : (c.lang === 'de' ? 'Das Stimmungsbild ist durchwachsen. Ein Kommentar bringt es auf den Punkt: "Solide, aber ich warte noch auf den Wow-Moment."' : 'Sentiment is mixed. One comment sums it up: "Solid, but I am still waiting for the wow moment."'),
  }),
  (c) => ({
    source: 'Seat 21C', handle: '@seat21c',
    headline: c.lang === 'de' ? 'Kolumne: Was ich auf meinem letzten Flug beobachtet habe' : 'Column: what I noticed on my last flight',
    description: c.hasTopFlight
      ? (c.lang === 'de' ? 'Manchmal erkennt man eine gute Airline an den Sekunden nach der Landung: keine Hektik, kein Klatschen nötig – einfach Ankommen. Genau so war es.' : 'Sometimes you recognise a good airline in the seconds after touchdown: no rush, no applause needed – just arriving. That is exactly how it felt.')
      : (c.lang === 'de' ? 'Es war kein schlechter Flug. Aber die besten Airlines geben einem das Gefühl, erwartet zu werden – daran kann hier noch gearbeitet werden.' : 'It was not a bad flight. But the best airlines make you feel expected – there is still work to do on that.'),
  }),
];

export const ATC_VARIANTS = [
  (c) => ({
    source: 'ATC Watch', handle: '@atc.watch',
    headline: c.hasIssues
      ? (c.lang === 'de' ? 'Operationsdesk schaut genauer auf die nächste Crewbesprechung' : 'Operations desk watching the next crew briefing')
      : (c.lang === 'de' ? 'Ops-Bulletin: Ein ruhiger Tag wird als Erfolg gelesen' : 'Ops bulletin: a quiet day is being read as success'),
    description: c.hasIssues
      ? (c.lang === 'de' ? 'Nach härteren Anflügen oder technischen Auffälligkeiten entscheidet jetzt die Reaktion: offen auswerten, Wartung ernst nehmen, den nächsten Umlauf sauber fliegen.' : 'After harder approaches or technical irregularities, the response matters: debrief honestly, take maintenance seriously, fly the next rotation cleanly.')
      : (c.lang === 'de' ? 'Die jüngsten Umläufe liefern keinen Stoff für Alarmmeldungen. In der Luftfahrt ist genau diese Langeweile oft das beste Kompliment.' : 'The latest rotations give monitors little to sound alarms about. In aviation, that kind of boredom is often the best compliment.'),
  }),
  (c) => ({
    source: 'Safety Desk', handle: '@safetydesk',
    headline: c.hasIssues
      ? (c.lang === 'de' ? 'Sicherheitsnotiz: Auffälligkeiten in den letzten Umläufen' : 'Safety note: irregularities in recent rotations')
      : (c.lang === 'de' ? 'Sicherheitsnotiz: Nichts zu berichten – und das ist die Nachricht' : 'Safety note: nothing to report – and that is the story'),
    description: c.hasIssues
      ? (c.lang === 'de' ? 'Harte Landungen und Systemmeldungen sind einzeln kein Drama – in Serie werden sie zum Muster. Die Frage ist, ob die Airline das Muster zuerst sieht.' : 'Hard landings and system alerts are no drama individually – in sequence they become a pattern. The question is whether the airline spots it first.')
      : (c.lang === 'de' ? 'Saubere Anflüge, keine Zwischenfälle, keine offenen Wartungsdramen. Der langweiligste Bericht des Monats – Kompliment an die Crews.' : 'Clean approaches, no incidents, no open maintenance drama. The most boring report of the month – compliments to the crews.'),
  }),
];

export const INVESTOR_VARIANTS = [
  (c) => ({
    source: 'Investor Radar', handle: '@investorradar',
    headline: c.lang === 'de' ? 'Wirtschaftsdesk fragt: Trägt der Alltag den Plan?' : 'Business desk asks whether daily flying can carry the plan',
    description: c.openContracts > 0
      ? (c.lang === 'de' ? `Mit ${c.openContracts} offenen Auftrag${c.openContracts === 1 ? '' : 'en'} liegt Hoffnung im Flugplan, aber auch Druck. Der Markt schaut darauf, ob jede Zusage wirklich abgeflogen wird.` : `With ${c.openContracts} open contract${c.openContracts === 1 ? '' : 's'}, there is hope in the schedule and pressure with it. The market watches whether every promise actually flies.`)
      : (c.lang === 'de' ? 'Ohne großen Auftragsdruck wirkt der Moment fast ungewöhnlich ruhig. Genau jetzt kann die Airline Reserven aufbauen.' : 'With no heavy contract pressure, the moment feels unusually quiet. This is where the airline can build reserves.'),
  }),
  (c) => ({
    source: 'Capital Runway', handle: '@capitalrunway',
    headline: c.lang === 'de' ? `Bewertungsfrage: Was ist ${c.airlineName} eigentlich wert?` : `Valuation question: what is ${c.airlineName} actually worth?`,
    description: c.openContracts > 0
      ? (c.lang === 'de' ? `Auftragsbestand: ${c.openContracts}. Für Beobachter ist weniger die Zahl interessant als die Abschlussquote – dort entscheidet sich der Multiplikator.` : `Order book: ${c.openContracts}. Observers care less about the number than the completion rate – that is where the multiple is decided.`)
      : (c.lang === 'de' ? 'Ein leerer Auftragsbestand kann Schwäche sein – oder die Ruhe vor dem nächsten Wachstumsschritt. Die kommenden Wochen werden es zeigen.' : 'An empty order book can be weakness – or the calm before the next growth step. The coming weeks will tell.'),
  }),
  (c) => ({
    source: 'MarketAlt FL350', handle: '@marketalt',
    headline: c.lang === 'de' ? 'Analystennotiz: Kleine Airline, große Beobachtungsliste' : 'Analyst note: small airline, big watchlist',
    description: c.lang === 'de'
      ? `Reputation ${c.reputation}%, ${c.openContracts} offene Aufträge, ${c.flightCount} ausgewertete Flüge – das Zahlenwerk von ${c.airlineName} liest sich wie ein Startup mit Flügeln. Kaufen, halten, beobachten? Wir sagen: beobachten.`
      : `Reputation ${c.reputation}%, ${c.openContracts} open contracts, ${c.flightCount} scored flights – ${c.airlineName}'s numbers read like a startup with wings. Buy, hold, watch? We say: watch.`,
  }),
];

export const LEDGER_VARIANTS = [
  (c) => ({
    source: 'Ledger Brief', handle: '@ledger.brief',
    headline: c.lang === 'de' ? 'Letzte Buchung erzählt mehr als nur eine Zahl' : 'Latest booking says more than the number',
    description: c.lang === 'de'
      ? `${c.detail} (${c.sign}${c.amount}). Für die Buchhaltung ist es eine Zeile; für die Airline ist es Treibstoff für die nächste Entscheidung.`
      : `${c.detail} (${c.sign}${c.amount}). For accounting it is one line; for the airline, it is fuel for the next decision.`,
  }),
  (c) => ({
    source: 'CFO Memo', handle: '@cfomemo',
    headline: c.lang === 'de' ? 'Aus dem Zahlenwerk: Die jüngste Bewegung auf dem Konto' : 'From the books: the latest movement on the account',
    description: c.lang === 'de'
      ? `${c.detail} – verbucht mit ${c.sign}${c.amount}. ${c.isIncome ? 'Einnahmen wie diese sind die leisen Helden jeder Airline-Bilanz.' : 'Ausgaben wie diese sind unbequem, aber oft die Basis des nächsten Wachstumsschritts.'}`
      : `${c.detail} – booked at ${c.sign}${c.amount}. ${c.isIncome ? 'Income like this is the quiet hero of every airline balance sheet.' : 'Costs like this are uncomfortable, but often fund the next growth step.'}`,
  }),
  (c) => ({
    source: 'The Ledger Post', handle: '@ledgerpost',
    headline: c.lang === 'de' ? `Kassensturz bei ${c.airlineName}` : `Cash check at ${c.airlineName}`,
    description: c.lang === 'de'
      ? `Jüngste Position: ${c.detail} über ${c.sign}${c.amount}. Wer Airlines verstehen will, liest keine Pressemitteilungen – er liest Kontoauszüge.`
      : `Latest entry: ${c.detail} at ${c.sign}${c.amount}. If you want to understand airlines, do not read press releases – read bank statements.`,
  }),
];