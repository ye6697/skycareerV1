// Generates passenger comments based on score, landing quality and incidents.
// This generator creates a very large variant space (>1000 combinations).
export function generatePassengerComments(score, data) {
  const comments = [];

  const pickRandom = (arr, n) => {
    if (!Array.isArray(arr) || arr.length === 0 || n <= 0) return [];
    const copy = [...arr];
    const out = [];
    const take = Math.min(n, copy.length);
    for (let i = 0; i < take; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return out;
  };

  const buildVariants = (openers, topics, details, closers, max = 120) => {
    const out = [];
    for (const a of openers) {
      for (const b of topics) {
        for (const c of details) {
          for (const d of closers) {
            out.push(`${a} ${b} ${c} ${d}`.replace(/\s+/g, " ").trim());
          }
        }
      }
    }
    if (out.length <= max) return out;
    return pickRandom(out, max);
  };

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const diversifyComment = (text) => {
    if (!text) return "";
    const lexicon = [
      [/\binsgesamt\b/gi, ["unter dem Strich", "in Summe", "gesamt betrachtet"]],
      [/\bokay\b/gi, ["solide", "brauchbar", "vertretbar"]],
      [/\bprofessionell\b/gi, ["souveraen", "routiniert", "fachlich stark"]],
      [/\bangenehm\b/gi, ["komfortabel", "entspannt", "wohltuend"]],
      [/\bunruhig\b/gi, ["wackelig", "nervoes", "instabil"]],
      [/\bdeutlich\b/gi, ["klar", "spuerbar", "offensichtlich"]],
      [/\bsehr\b/gi, ["wirklich", "spuerbar", "auffallend"]],
    ];
    let output = String(text).trim();
    for (const [rx, options] of shuffle(lexicon).slice(0, 3)) {
      if (rx.test(output)) {
        const replacement = options[Math.floor(Math.random() * options.length)];
        output = output.replace(rx, replacement);
      }
    }
    if (Math.random() < 0.2) output = `Ehrlich gesagt: ${output}`;
    else if (Math.random() < 0.2) output = `Kabinenfazit: ${output}`;
    return output.replace(/\s+/g, " ").trim();
  };

  // Crash path stays explicit and severe.
  if (data?.events?.crash) {
    const crashOpeners = [
      "Das war ein absoluter Albtraum.",
      "Ich habe echte Panik erlebt.",
      "So einen Flug habe ich noch nie erlebt.",
      "Das war lebensgefaehrlich.",
      "Wir hatten Todesangst in der Kabine.",
      "Ich bin immer noch komplett geschockt.",
    ];
    const crashTopics = [
      "Der Flug wirkte zu keinem Zeitpunkt stabil.",
      "Die Situation an Bord war chaotisch.",
      "Alle Passagiere waren in Alarmbereitschaft.",
      "Niemand fuehlte sich sicher.",
      "Das Vertrauen in die Crew war weg.",
      "Es gab nur noch Angst statt Kontrolle.",
    ];
    const crashDetails = [
      "Ich werde das sofort offiziell melden.",
      "Ich will eine vollstaendige Untersuchung.",
      "So etwas darf nicht noch einmal passieren.",
      "Ich fordere eine sofortige Entschaedigung.",
      "Das war keine vertretbare Flugfuehrung.",
      "Ich werde definitiv nie wieder hier buchen.",
    ];
    const crashClosers = [
      "Unfassbar.",
      "Nie wieder.",
      "Absolut inakzeptabel.",
      "Das geht gar nicht.",
      "Vollkommen unverantwortlich.",
      "Das war zu viel.",
    ];

    const crashPool = buildVariants(crashOpeners, crashTopics, crashDetails, crashClosers, 240);
    return pickRandom(crashPool, 6);
  }

  const qualityOpeners = [
    "Aus Passagiersicht:",
    "Mein Eindruck:",
    "Fazit aus der Kabine:",
    "Persoenliche Bewertung:",
    "Rueckmeldung zum Flug:",
    "Kurz gesagt:",
    "Unterm Strich:",
    "Mein Gesamtbild:",
  ];

  const qualityClosersGood = [
    "Gerne wieder.",
    "Sehr ueberzeugend.",
    "Danke fuer den angenehmen Flug.",
    "Das war professionell.",
    "Weiter so.",
    "Top Leistung.",
    "Starker Auftritt der Crew.",
  ];

  const qualityClosersMid = [
    "In Ordnung insgesamt.",
    "Kann man so machen.",
    "War okay.",
    "Mit Luft nach oben.",
    "Nicht perfekt, aber akzeptabel.",
    "Durchschnittlich.",
    "Stabil, aber nicht besonders.",
  ];

  const qualityClosersBad = [
    "Da muss mehr Qualitaet her.",
    "Das war nicht ueberzeugend.",
    "Ich bin unzufrieden.",
    "Bitte deutlich verbessern.",
    "So fuehlte es sich nicht gut an.",
    "Das war eher schwach.",
    "Beim naechsten Mal bitte besser.",
  ];

  const landingByType = {
    butter: {
      topics: ["die Landung war aussergewoehnlich sanft,", "das Aufsetzen war praktisch nicht spuerbar,", "die Landung fuehlte sich wie auf Schienen an,", "Touchdown war perfekt kontrolliert,"],
      details: ["kein Ruck, kein Stoeren.", "Kaffee blieb ruhig stehen.", "man merkte sofort echte Praezision.", "das war Premium-Niveau."],
      closers: qualityClosersGood,
      count: 4,
    },
    soft: {
      topics: ["die Landung war angenehm weich,", "der Touchdown war sauber,", "das Aufsetzen war ruhig und sicher,", "die Landung fuehlte sich sehr solide an,"],
      details: ["keine harte Belastung in der Kabine.", "sehr ordentliche Flugfuehrung.", "das wirkte professionell.", "gut abgestimmt bis zum Ende."],
      closers: qualityClosersGood,
      count: 3,
    },
    acceptable: {
      topics: ["die Landung war okay,", "das Aufsetzen war im Rahmen,", "der Abschluss war durchschnittlich,", "insgesamt war die Landung solide,"],
      details: ["man hat den Boden deutlich gemerkt.", "kein Highlight, aber vertretbar.", "das ging in Ordnung.", "aus Passagiersicht akzeptabel."],
      closers: qualityClosersMid,
      count: 2,
    },
    hard: {
      topics: ["die Landung war deutlich zu hart,", "der Touchdown war unangenehm,", "das Aufsetzen war heftig spuerrbar,", "das Fahrwerk wurde stark belastet,"],
      details: ["Getraenke und Gepaeck sind verrutscht.", "die Kabine hat klar reagiert.", "das war grenzwertig.", "so fuehlt sich keine gute Landung an."],
      closers: qualityClosersBad,
      count: 3,
    },
    very_hard: {
      topics: ["die Landung war extrem hart,", "der Aufprall war schockierend,", "das Aufsetzen war brutal,", "das fuehlte sich fast wie ein Einschlag an,"],
      details: ["mehrere Passagiere waren verunsichert.", "das war sicherheitskritisch gefuehlt.", "so etwas darf nicht normal sein.", "das war fuer die Kabine zu viel."],
      closers: qualityClosersBad,
      count: 4,
    },
  };

  const landingCfg = landingByType[data?.landingType] || null;
  if (landingCfg) {
    const landingPool = buildVariants(
      qualityOpeners,
      landingCfg.topics,
      landingCfg.details,
      landingCfg.closers,
      320
    );
    comments.push(...pickRandom(landingPool, landingCfg.count));
  }

  // G-force reaction comments
  const maxG = Number(data?.maxGForce || 1.0);
  if (maxG > 2.5) {
    const gPool = buildVariants(
      ["Die Manoever waehrend des Fluges waren sehr extrem,", "Die Belastung war fuer Passagiere deutlich zu hoch,", "Bei den Bewegungen in der Luft wurde es kritisch,"],
      ["man wurde stark in den Sitz gedrueckt,", "die Kabine war sehr unruhig,", "viele waren koerperlich ueberfordert,"],
      ["mir wurde richtig unwohl.", "mehrere Passagiere hatten Angst.", "das fuehlte sich nicht mehr normal an."],
      qualityClosersBad,
      180
    );
    comments.push(...pickRandom(gPool, 2));
  } else if (maxG < 1.25) {
    const smoothPool = buildVariants(
      ["Der Flug war sehr ruhig,", "Die Kabinenruhe war auffallend gut,", "Angenehmes Fluggefuehl insgesamt,"],
      ["kaum Stoerungen waehrend der Reise,", "stabile Fluglage ueber lange Phasen,", "sehr gleichmaessige Bewegungen,"],
      ["man konnte entspannt bleiben.", "ideal fuer entspanntes Reisen.", "das war sehr komfortabel."],
      qualityClosersGood,
      180
    );
    comments.push(...pickRandom(smoothPool, 2));
  } else {
    const normalPool = buildVariants(
      ["Flugverlauf insgesamt normal,", "Die Stabilitaet war mittelmaessig,", "Kabinenkomfort war okay,"],
      ["ein paar unruhige Momente,", "zeitweise merklich Bewegung,", "insgesamt vertretbar,"],
      ["kein Drama, aber nicht ganz smooth.", "mit kleinen Stoerungen im Verlauf.", "durchschnittliches Fluggefuehl."],
      qualityClosersMid,
      180
    );
    comments.push(...pickRandom(normalPool, 1));
  }

  // Score-driven generic sentiment
  const scoreBand = Number(score || 0);
  const scoreHighPool = buildVariants(
    ["Servicebewertung:", "Gesamteindruck:", "Reiseerlebnis:"],
    ["Crew wirkte vorbereitet,", "Ablauf war professionell,", "Kommunikation war klar,"],
    ["das Gesamtpaket passt.", "das fuehlte sich hochwertig an.", "ich war zufrieden."],
    qualityClosersGood,
    180
  );
  const scoreMidPool = buildVariants(
    ["Servicebewertung:", "Gesamteindruck:", "Reiseerlebnis:"],
    ["Crew war solide,", "Ablauf war brauchbar,", "Kommunikation war okay,"],
    ["es war durchschnittlich.", "hier ist Potenzial offen.", "mit gemischtem Eindruck."],
    qualityClosersMid,
    180
  );
  const scoreLowPool = buildVariants(
    ["Servicebewertung:", "Gesamteindruck:", "Reiseerlebnis:"],
    ["Crew wirkte gestresst,", "Ablauf war holprig,", "Kommunikation war unklar,"],
    ["das war nicht ueberzeugend.", "das muss besser werden.", "ich wuerde das so nicht empfehlen."],
    qualityClosersBad,
    180
  );

  if (scoreBand >= 90) comments.push(...pickRandom(scoreHighPool, 2));
  else if (scoreBand >= 70) comments.push(...pickRandom(scoreMidPool, 2));
  else comments.push(...pickRandom(scoreLowPool, 2));

  // Incident-specific comments
  const incidentTemplates = {
    tailstrike: buildVariants(
      ["Beim Heckkontakt gab es einen Schreckmoment,", "Das Heckereignis war klar spuerbar,", "Beim Kontakt am Heck wurde es laut,"],
      ["deutlicher Schlag im Rumpf,", "ungewoehnliche Geraeusche hinten,", "spuerbarer Stoerimpuls in der Kabine,"],
      ["das wirkte riskant.", "das hat Vertrauen gekostet.", "so etwas verunsichert."],
      qualityClosersBad,
      90
    ),
    stall: buildVariants(
      ["Beim Stroemungsabriss war kurz Panik,", "Der Stall-Moment war deutlich merkbar,", "Beim Absacken wurde es unruhig,"],
      ["starker Unsicherheitsmoment an Bord,", "mehrere Passagiere erschraken,", "das fuehlte sich gefaehrlich an,"],
      ["bitte vermeiden.", "das war kritisch.", "so etwas darf nicht passieren."],
      qualityClosersBad,
      90
    ),
    overstress: buildVariants(
      ["Bei hoher Strukturbelastung wirkte alles angespannt,", "In der Belastungsphase war es beunruhigend,", "Bei den starken Kraeften gab es deutliche Reaktionen,"],
      ["spuerbares Zittern in der Kabine,", "ungewohnte Belastung fuer Passagiere,", "klarer Stressmoment im Flugzeug,"],
      ["das war zu viel.", "hier braucht es mehr Reserve.", "bitte sicherer fliegen."],
      qualityClosersBad,
      90
    ),
    flaps_overspeed: buildVariants(
      ["Bei den Klappen gab es auffaellige Geraeusche,", "Die Fluegelkonfiguration wirkte nicht passend,", "In der Flaps-Phase fuehlte es sich falsch an,"],
      ["deutliches Rattern an den Flaechen,", "ungewoehnlicher Luftstrom und Vibrationen,", "klarer Belastungsmoment am Fluegel,"],
      ["das sollte sauberer laufen.", "das braucht bessere Konfiguration.", "das war unangenehm."],
      qualityClosersBad,
      90
    ),
    gear_up_landing: buildVariants(
      ["Die Landung ohne ausgefahrenes Fahrwerk war extrem,", "Beim Gear-Up-Moment war totale Anspannung,", "Das Ereignis bei der Landung war erschreckend,"],
      ["starke Reibgeraeusche und Stress,", "deutliches Risiko fuer alle an Bord,", "eine Situation, die niemand erleben will,"],
      ["nie wieder.", "unbedingt verhindern.", "das war inakzeptabel."],
      qualityClosersBad,
      90
    ),
    hard_landing: buildVariants(
      ["Die harte Landung war sehr unangenehm,", "Beim harten Aufsetzen gab es einen starken Ruck,", "Der Touchdown war klar ueber der Komfortgrenze,"],
      ["mehrere Personen wurden durchgeschuettelt,", "Getraenke und Gepaeck waren betroffen,", "die Kabine hat es deutlich gemerkt,"],
      ["bitte sanfter landen.", "das muss besser abgefangen werden.", "da ist Verbesserungsbedarf."],
      qualityClosersBad,
      90
    ),
    fuel_emergency: buildVariants(
      ["Die Treibstoffsituation war beunruhigend,", "Die Fuel-Reserve wirkte zu knapp geplant,", "Das Thema Resttreibstoff war kritisch,"],
      ["spuerbarer Druck bei der Ankunft,", "das fuehlte sich nicht komfortabel an,", "Passagiere waren verunsichert,"],
      ["hier braucht es mehr Puffer.", "bitte konservativer planen.", "das war riskant."],
      qualityClosersBad,
      90
    ),
  };

  if (data?.events?.tailstrike) comments.push(...pickRandom(incidentTemplates.tailstrike, 1));
  if (data?.events?.stall) comments.push(...pickRandom(incidentTemplates.stall, 1));
  if (data?.events?.overstress) comments.push(...pickRandom(incidentTemplates.overstress, 1));
  if (data?.events?.flaps_overspeed) comments.push(...pickRandom(incidentTemplates.flaps_overspeed, 1));
  if (data?.events?.gear_up_landing) comments.push(...pickRandom(incidentTemplates.gear_up_landing, 1));
  if (data?.events?.hard_landing) comments.push(...pickRandom(incidentTemplates.hard_landing, 1));
  if (data?.events?.fuel_emergency && Number(data?.fuel || 100) < 5) comments.push(...pickRandom(incidentTemplates.fuel_emergency, 1));

  // De-duplicate and cap output count for UI readability.
  const unique = [];
  const seen = new Set();
  for (const c of comments) {
    const k = diversifyComment(c);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(k);
  }

  const minOutput = 4;
  const targetOutput = 8;
  if (unique.length < minOutput) {
    unique.push(
      ...pickRandom(
        buildVariants(
          ["Gesamtfazit:", "Kurzfazit:", "Aus Passagiersicht:"],
          ["der Flug war nachvollziehbar,", "der Ablauf war klar,", "die Reise war insgesamt stimmig,"],
          ["ankommen stand im Fokus.", "das Ergebnis passt im Kern.", "insgesamt vertretbar."],
          qualityClosersMid,
          80
        ),
        minOutput - unique.length
      )
    );
  }

  return unique.slice(0, targetOutput);
}
