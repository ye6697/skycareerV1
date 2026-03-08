// Generates passenger comments based on flight score and events
export function generatePassengerComments(score, data) {
  const pickRandom = (arr, n) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, arr.length));
  };

  const comments = [];

  if (data.events.crash) {
    return pickRandom([
      "Flugzeug zerstört! Nie wieder mit dieser Airline!",
      "Das war die schlimmste Erfahrung meines Lebens.",
      "Ich bin froh, dass ich überlebt habe...",
      "Meine Familie wird von meinem Anwalt hören!",
      "Ich zittere immer noch am ganzen Körper.",
      "Das war kein Flug, das war ein Albtraum!",
      "Ich habe mein Testament geschrieben während wir gefallen sind.",
      "Die Sauerstoffmasken sind runtergefallen - totale Panik!",
      "Mein Leben ist an mir vorbeigeflogen. Buchstäblich.",
      "Ich werde nie wieder ein Flugzeug betreten!",
      "Haben die überhaupt einen Pilotenschein?!",
      "Das war versuchter Mord mit einem Flugzeug!",
      "Meine Kinder haben geweint, meine Frau hat geschrien.",
      "Der Aufprall war so heftig, mein Handy ist zerbrochen.",
      "Ich brauche jetzt erstmal eine Therapie.",
    ], 4);
  }

  const butterPool = ["Butterweiche Landung! Das war professionell!","Ich habe kaum bemerkt, dass wir gelandet sind - perfekt!","So muss eine Landung sein! Chapeau, Kapitän!","Mein Kaffee stand noch aufrecht - unglaublich sanft!","Ich dachte, wir fliegen noch - erst als die Bremsen kamen, merkte ich es.","Das war die sanfteste Landung meines Lebens!","Wie auf einer Wolke gelandet. Meisterleistung!","Der Pilot könnte auch eine Feder landen, ohne sie zu knicken.","Standing Ovation in der Kabine! Alle haben geklatscht!","Meine Oma hätte nicht gemerkt, dass wir gelandet sind.","Wie Butter auf heißem Toast - perfekt!","Die Landung war so sanft, mein Baby hat weitergeschlafen.","Besser als jeder Langstreckenflug, den ich je hatte!","Ich glaube, der Pilot hat ein Gefühl wie ein Chirurg."];
  const softPool = ["Sehr sanfte Landung, ausgezeichnet!","Der Pilot weiß, wie man landen muss.","Angenehme Landung, meine Kinder haben nicht mal aufgewacht.","Gute Landung! Kaum Erschütterung.","Sanftes Aufsetzen - genau so soll es sein.","Professionelle Landung, ich bin beeindruckt.","Man merkt, dass der Pilot Erfahrung hat.","Angenehm sanft, wie auf einer Matratze gelandet.","Schöne Landung, da kann man sich wohlfühlen.","Nicht ganz Butter, aber sehr nah dran!","Guter Pilot - die Landung war toll."];
  const acceptablePool = ["Ganz normale Landung, nichts besonderes.","Alles in Ordnung, solide gelandet.","Standard-Landung, kein Grund zur Beschwerde.","Okay, hat funktioniert. Mehr gibt's nicht zu sagen.","Normale Landung - nicht schlecht, nicht überragend.","Bin heil angekommen, das zählt.","Durchschnittliche Landung, alles im Rahmen.","Passt schon, war jetzt nicht außergewöhnlich.","Solide Arbeit, man hat den Boden gespürt.","In Ordnung. Würde wieder fliegen."];
  const hardPool = ["Die Landung war ziemlich hart...","Mein Getränk ist umgekippt!","Mein Rücken tut weh nach dieser Landung.","Das Fahrwerk hat laut geknallt - war das normal?!","Autsch! Das hat ordentlich gerüttelt.","Mein Gepäck ist im Fach verrutscht bei dem Aufprall.","Ich hoffe, das Flugzeug hat das überlebt...","Da hat wohl jemand den Boden verwechselt mit einer Landebahn.","Mein Nacken tut weh - das war zu hart!","Haben wir auf der Landebahn oder daneben aufgesetzt?","Das war eher ein Aufprall als eine Landung.","Meine Zähne haben geklickert bei dem Stoß!","Der Steward hat seinen Trolley verloren bei der Landung.","Ich glaube, mein Koffer ist jetzt flacher als vorher."];
  const veryHardPool = ["Das war eine brutale Landung!","Ich bin mir nicht sicher, ob das sicher war.","Mein Gepäck ist aus dem Fach gefallen!","Sind die Reifen noch dran?!","Das Flugzeug hat gezittert wie verrückt!","Mein Sitz hat sich verschoben - das geht doch nicht!","Ich habe mir den Kopf am Vordersitz gestoßen!","Das war keine Landung, das war ein kontrollierter Absturz!","Die Sauerstoffmasken sind fast runtergefallen!","Meine Knie sind blau von dem Aufprall!","Hat der Pilot die Landung in einer Simulation gelernt?!","Ich brauche nach dieser Landung einen Chiropraktiker.","Das Flugzeug braucht definitiv eine Inspektion nach dem..."];

  if (data.landingType === 'butter') comments.push(...pickRandom(butterPool, 3));
  else if (data.landingType === 'soft') comments.push(...pickRandom(softPool, 2));
  else if (data.landingType === 'acceptable') comments.push(...pickRandom(acceptablePool, 2));
  else if (data.landingType === 'hard') comments.push(...pickRandom(hardPool, 3));
  else if (data.landingType === 'very_hard') comments.push(...pickRandom(veryHardPool, 3));

  if (data.maxGForce > 2.5) comments.push(...pickRandom(["Mir wurde bei den extremen Manövern richtig schlecht.","Ich dachte, ich bin in einer Achterbahn und nicht im Flugzeug!","Mein Magen hat sich mehrfach umgedreht.","Die Kinder neben mir haben alle geweint.","Ich habe in die Tüte gegeben, kein Scherz.","So viel G-Kraft habe ich nicht mal im Freizeitpark erlebt!"], 2));
  else if (data.maxGForce > 2.0) comments.push(...pickRandom(["Die Manöver waren viel zu heftig für einen normalen Flug.","Bei den Kurven hat es mich ordentlich in den Sitz gedrückt.","Die Turbulenz war heftig - oder war das der Pilot?","Mein Getränk ist bei einem Manöver komplett ausgelaufen."], 1));
  else if (data.maxGForce > 1.8) comments.push(...pickRandom(["Es war ziemlich wackelig während des Fluges.","Ein paar Turbulenzen, aber ging gerade so.","Etwas unruhig zwischendurch, aber überlebbar."], 1));
  else if (data.maxGForce < 1.2) comments.push(...pickRandom(["Sehr angenehmer, sanfter Flug. Wie auf Wolken!","Ruhigster Flug, den ich je hatte!","Null Turbulenzen, absolut genial!","Ich konnte in Ruhe lesen, so ruhig war der Flug.","Traumhaft ruhig - wie im Schlafwagen!"], 2));
  else if (data.maxGForce < 1.3) comments.push(...pickRandom(["Ruhiger Flug, gut gemacht.","Kaum Turbulenzen, angenehm.","Entspannter Flug, gerne wieder."], 1));

  if (score >= 95) comments.push(...pickRandom(["Perfekter Flug! Werde diese Airline weiterempfehlen!","5 Sterne! Besser geht es nicht.","Absolut erstklassig! Buche sofort den nächsten Flug!","Das war Premium-Service - besser als manche Businessclass!","Wow, diese Airline hat mich überzeugt!","Von der Begrüßung bis zur Landung: makellos.","Mein neuer Favorit unter den Airlines!","Ich bin begeistert. Perfekt von Anfang bis Ende."], 2));
  else if (score >= 85) comments.push(...pickRandom(["Sehr guter Service, gerne wieder.","Professionelle Crew, angenehmer Flug.","Guter Flug, keine Beschwerden!","Empfehlenswert! Gutes Preis-Leistungs-Verhältnis.","Solider Service, kompetente Crew.","War ein schöner Flug, vielen Dank!","4 Sterne - fast perfekt!"], 2));
  else if (score >= 70) comments.push(...pickRandom(["Solider Flug, nichts zu beanstanden.","War in Ordnung, durchschnittlich halt.","Ging so - weder gut noch schlecht.","Mittelmaß, aber akzeptabel.","Okay, aber ich habe schon bessere Flüge erlebt."], 1));
  else if (score >= 50) comments.push(...pickRandom(["Es war okay, aber es gibt Verbesserungspotenzial.","Nicht der beste Flug, den ich je hatte...","Naja, angekommen sind wir immerhin.","Könnte definitiv besser sein.","Bin nicht wirklich zufrieden mit dem Flug.","Mal schauen, ob ich nächstes Mal eine andere Airline nehme."], 2));
  else if (score >= 30) comments.push(...pickRandom(["Ich buche nie wieder bei dieser Airline.","Katastrophal. Ich habe Angst gehabt.","Das war eine Zumutung für jeden Passagier.","Unfassbar schlecht. Null Professionalität!","Meine schlechteste Flugerfahrung überhaupt.","Ich verlange eine Rückerstattung!"], 2));
  else comments.push(...pickRandom(["Nie wieder! Das war lebensgefährlich!","Ich stelle eine Beschwerde bei der Luftfahrtbehörde!","Die sollten den Pilotenschein abgeben!","Dieser Airline gehört die Lizenz entzogen!","Das war eine Gefährdung aller Passagiere!","Ich kann nicht glauben, dass das legal war."], 2));

  if (data.events.tailstrike) comments.push(...pickRandom(["Ich habe gehört, wie das Heck aufgesetzt hat - furchtbar!","Beim Start hat es laut gekracht am Heck...","Was war das für ein Geräusch hinten?! Das klang nach Metall!","Das Heck hat den Boden berührt - das ist doch gefährlich!","Ein lauter Schlag am Heck - ich dachte, wir brechen auseinander!"], 2));
  if (data.events.stall) comments.push(...pickRandom(["Das Flugzeug ist plötzlich abgesackt! Panik an Bord!","Strömungsabriss?! Das darf nicht passieren!","Wir sind plötzlich gefallen wie ein Stein!","Für einen Moment dachte ich, das war's...","Alle haben geschrien, als das Flugzeug absackte!","Mein Herz hat ausgesetzt, als wir plötzlich gefallen sind!"], 2));
  if (data.events.overstress) comments.push(...pickRandom(["Das Flugzeug hat beängstigende Geräusche gemacht...","Es hat geknackt und geächzt - das kann nicht normal sein!","Die Tragflächen haben sich so stark gebogen, ich hatte Angst!","Das Flugzeug hat gezittert wie verrückt!"], 1));
  if (data.events.flaps_overspeed) comments.push(...pickRandom(["Die Klappen haben komische Geräusche gemacht bei der Geschwindigkeit.","Irgendwas an den Flügeln hat laut gerattert...","Das klang, als würde etwas am Flügel abreißen!","Warum waren die Klappen bei dieser Geschwindigkeit draußen?!"], 1));
  if (data.events.hard_landing) comments.push(...pickRandom(["Meine Knochen vibrieren noch von dieser Landung.","Bei der Landung habe ich meinen Kaffee verloren.","Das Fahrwerk hat laut gescheppert!","Mein ganzer Körper tut weh nach dieser Landung.","Hat der Pilot die Landebahn treffen wollen oder den Planeten?"], 1));
  if (data.events.fuel_emergency && data.fuel < 3) comments.push(...pickRandom(["Wir hatten kaum noch Treibstoff?! Das ist unverantwortlich!","Der Pilot hat es auf den letzten Tropfen ankommen lassen!","Fast kein Sprit mehr?! Das ist doch wahnsinnig!","Ich habe gehört, dass wir fast keinen Treibstoff mehr hatten!"], 1));
  if (data.events.gear_up_landing) comments.push(...pickRandom(["Er ist OHNE Fahrwerk gelandet?! Unfassbar!","Die Funken auf der Landebahn werde ich nie vergessen!","Bauchlanden ist für mich ab heute kein Fremdwort mehr.","Das Kreischen des Metalls auf dem Asphalt... schrecklich!"], 1));

  return comments;
}