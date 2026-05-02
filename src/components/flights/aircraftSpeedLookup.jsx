// Mapping of X-Plane aircraft ICAO type codes to realistic cruise speeds (in knots TAS)
// Used for dynamic deadline calculation based on the actual aircraft being flown in X-Plane

const aircraftCruiseSpeeds = {
  // ---- Small Props ----
  "C172": 122, "C182": 145, "C206": 155, "C208": 185, "C210": 165,
  "PA28": 125, "PA32": 155, "PA34": 170, "PA46": 215, "BE36": 175,
  "BE58": 200, "M20T": 195, "SR22": 185, "DA40": 147, "DA42": 190,
  "DA62": 192, "P28A": 125, "P32R": 160, "BE35": 170, "C150": 105,
  "C152": 110, "RV7": 185, "RV10": 195, "P28R": 155, "PA24": 160,
  "C177": 130, "C185": 155, "PA18": 100, "PA22": 120, "DV20": 120,
  "VENT": 100, "ICON": 95, "A5": 95, "DR40": 135, "C208B": 185,
  "BE33": 175, "G36": 175, "KODI": 175,

  // ---- Turboprops ----
  "B350": 310, "PC12": 280, "C90": 245, "BE20": 290, "TBM9": 330,
  "TBM8": 320, "TBM7": 300, "KODK": 175, "PC24": 420, "AT76": 275, "AT75": 270, "AT72": 275,
  "AT45": 260, "AT43": 260, "DH8D": 360, "DH8C": 310, "DH8B": 290,
  "DH8A": 270, "JS41": 260, "JS32": 280, "D228": 195, "L410": 210,
  "SF34": 260, "E120": 290, "AN24": 250, "C130": 290, "P180": 395,
  "SW4": 240, "BE99": 240, "PC6T": 130, "DHC6": 160, "B190": 280,
  "C208": 185, "U21A": 245, "SH36": 190,

  // ---- Regional Jets ----
  "E170": 430, "E175": 430, "E190": 445, "E195": 445, "E75S": 430,
  "E75L": 430, "E55P": 465, "CRJ2": 420, "CRJ7": 430, "CRJ9": 430,
  "CRJX": 435, "E135": 420, "E145": 420, "F100": 420, "F70": 420,
  "BA46": 400, "SB20": 340, "D328": 335, "BCS1": 470, "BCS3": 470,

  // ---- Narrow Body Jets ----
  "A318": 450, "A319": 455, "A320": 460, "A321": 460, "A20N": 460,
  "A21N": 460, "B731": 440, "B732": 440, "B733": 445, "B734": 450,
  "B735": 450, "B736": 450, "B737": 455, "B738": 460, "B739": 460,
  "B38M": 460, "B39M": 460, "B37M": 460, "B752": 470, "B753": 470,
  "MD82": 440, "MD83": 440, "MD87": 440, "MD88": 440, "MD90": 445,
  "B712": 440, "T204": 430, "T154": 460, "IL62": 450, "C25A": 405,
  "C25B": 405, "C510": 360, "C525": 380, "C56X": 430, "C560": 420,
  "C680": 460, "CL30": 460, "CL35": 460, "CL60": 460, "GL5T": 480,
  "GLEX": 480, "G280": 470, "GLF4": 460, "GLF5": 480, "GLF6": 480,
  "E550": 460, "E55P": 465, "F2TH": 460, "FA7X": 460, "FA8X": 470,
  "FA50": 440, "LJ35": 430, "LJ45": 440, "LJ60": 440, "LJ75": 445,
  "PC24": 420, "PRM1": 430, "HDJT": 380, "SF50": 300, "EA50": 340,
  "HDJT": 380, "HA42": 420, "C25C": 420, "C68A": 460, "C700": 460,

  // ---- Wide Body Jets ----
  "A310": 470, "A332": 480, "A333": 480, "A338": 480, "A339": 480, "A342": 475,
  "A343": 475, "A345": 480, "A346": 480, "A359": 490, "A35K": 490,
  "A388": 490, "B762": 475, "B763": 480, "B764": 480, "B772": 490,
  "B773": 490, "B77L": 490, "B77W": 490, "B744": 490, "B748": 495,
  "B788": 490, "B789": 490, "B78X": 490, "MD11": 480, "DC10": 470,
  "A306": 470, "A310": 470, "IL96": 470, "B741": 480, "B742": 480,
  "B743": 485, "L101": 470,

  // ---- Cargo ----
  "A30B": 450, "AN12": 330, "AN26": 250, "IL76": 430, "C17": 450,
  "C5": 450, "B462": 410,
};

// Fallback speeds by fleet aircraft type category
const categoryFallbackSpeeds = {
  small_prop: 140,
  turboprop: 280,
  regional_jet: 430,
  narrow_body: 460,
  wide_body: 490,
  cargo: 450,
};

/**
 * Get the cruise speed for an aircraft, trying X-Plane ICAO first, then fleet type fallback
 * @param {string|null} xplaneIcao - The aircraft_icao reported by X-Plane (e.g. "B738", "A320")
 * @param {string|null} fleetAircraftType - The fleet aircraft category (e.g. "narrow_body")
 * @returns {number} Cruise speed in knots
 */
export function getCruiseSpeed(xplaneIcao, fleetAircraftType) {
  // 1. Try exact match from X-Plane ICAO
  if (xplaneIcao && aircraftCruiseSpeeds[xplaneIcao.toUpperCase()]) {
    return aircraftCruiseSpeeds[xplaneIcao.toUpperCase()];
  }

  // 2. Try partial match (first 3-4 chars, e.g. "B738_something" → "B738")
  if (xplaneIcao) {
    const cleaned = xplaneIcao.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Try 4 chars, then 3 chars
    for (const len of [4, 3]) {
      const prefix = cleaned.substring(0, len);
      if (aircraftCruiseSpeeds[prefix]) {
        return aircraftCruiseSpeeds[prefix];
      }
    }
  }

  // 3. Fallback to fleet aircraft type category
  if (fleetAircraftType && categoryFallbackSpeeds[fleetAircraftType]) {
    return categoryFallbackSpeeds[fleetAircraftType];
  }

  // 4. Ultimate fallback
  return 250;
}

/**
 * Calculate deadline in minutes for a given distance and aircraft
 * @param {number} distanceNm - Distance in nautical miles
 * @param {string|null} xplaneIcao - X-Plane aircraft ICAO code
 * @param {string|null} fleetAircraftType - Fleet aircraft category
 * @returns {number} Deadline in minutes
 */
export function calculateDeadlineMinutes(distanceNm, xplaneIcao, fleetAircraftType) {
  const cruiseSpeed = getCruiseSpeed(xplaneIcao, fleetAircraftType);
  // Flight time + 20min taxi/climb/descent + 15min buffer
  return Math.round((distanceNm / cruiseSpeed) * 60 + 20 + 15);
}

// Mapping from common aircraft model names (as used in the marketplace) to ICAO type codes.
// Used to resolve a realistic max cruise speed for fleet/market UI.
const MODEL_NAME_TO_ICAO = [
  // Small Props
  [/icon\s*a5/i, "ICON"], [/piper\s*pa-?18.*super\s*cub/i, "PA18"], [/robin\s*dr400/i, "DR40"],
  [/cessna\s*152/i, "C152"], [/cessna\s*150/i, "C150"], [/cessna\s*172/i, "C172"],
  [/cessna\s*182/i, "C182"], [/cessna\s*177/i, "C177"], [/cessna\s*185/i, "C185"],
  [/cessna\s*206/i, "C206"], [/cessna\s*210/i, "C210"], [/cessna\s*208b?\s*(grand\s*)?caravan/i, "C208"],
  [/vans?\s*rv-?10/i, "RV10"], [/vans?\s*rv-?7/i, "RV7"],
  [/diamond\s*da40/i, "DA40"], [/diamond\s*da42/i, "DA42"], [/diamond\s*da62/i, "DA62"],
  [/cirrus\s*sr22/i, "SR22"], [/cirrus\s*vision\s*sf?50/i, "SF50"],
  [/beechcraft\s*bonanza|bonanza\s*g36/i, "G36"], [/beechcraft\s*baron\s*58|baron\s*58/i, "BE58"],
  [/honda\s*(ha-?420\s*)?hondajet/i, "HDJT"],
  // Turboprops
  [/daher\s*kodiak\s*100/i, "KODI"], [/lancair\s*evolution/i, "PA46"],
  [/daher\s*tbm\s*930|tbm\s*930/i, "TBM9"], [/tbm\s*940/i, "TBM9"], [/tbm\s*900/i, "TBM9"],
  [/king\s*air\s*c?90/i, "C90"], [/king\s*air\s*350/i, "B350"], [/king\s*air/i, "BE20"],
  [/pilatus\s*pc-?12/i, "PC12"], [/pilatus\s*pc-?24/i, "PC24"],
  [/atr\s*72f/i, "AT76"], [/atr\s*72/i, "AT76"], [/atr\s*42/i, "AT43"],
  [/bombardier\s*dash\s*8-?400|dash\s*8-?400|dhc-?8/i, "DH8D"],
  // Regional Jets
  [/cessna\s*citation\s*cj4/i, "C25C"], [/cessna\s*citation\s*longitude/i, "C700"],
  [/cessna\s*citation\s*x/i, "C750"], [/cessna\s*citation/i, "C25A"],
  [/bombardier\s*crj-?200|crj\s*200/i, "CRJ2"], [/bombardier\s*crj-?700|crj\s*700/i, "CRJ7"],
  [/bombardier\s*crj-?900|crj\s*900/i, "CRJ9"],
  [/embraer\s*e?175|e-?175/i, "E175"], [/embraer\s*e?170|e-?170/i, "E170"],
  [/embraer\s*e?190|e-?190/i, "E190"], [/embraer\s*e?195|e-?195/i, "E195"],
  [/airbus\s*a220-?300|a220/i, "BCS3"],
  // Narrow Body
  [/mcdonnell\s*douglas\s*md-?82|md-?82/i, "MD82"], [/md-?83/i, "MD83"], [/md-?88/i, "MD88"],
  [/airbus\s*a310-?300|a310/i, "A310"], [/airbus\s*a318/i, "A318"], [/airbus\s*a319/i, "A319"],
  [/airbus\s*a320neo|a320\s*neo|a20n/i, "A20N"], [/airbus\s*a320/i, "A320"],
  [/airbus\s*a321neo|a321\s*neo|a21n/i, "A21N"], [/airbus\s*a321/i, "A321"],
  [/boeing\s*737-?700|737-?700/i, "B737"], [/boeing\s*737-?800|737-?800/i, "B738"],
  [/boeing\s*737\s*max\s*8|737\s*max\s*8|b38m/i, "B38M"], [/boeing\s*737\s*max\s*9|737\s*max\s*9|b39m/i, "B39M"],
  [/boeing\s*737/i, "B737"], [/boeing\s*757-?200|757-?200/i, "B752"],
  [/boeing\s*787-?8|787-?8/i, "B788"], [/boeing\s*787-?9|787-?9/i, "B789"],
  [/boeing\s*787-?10|787-?10/i, "B78X"], [/boeing\s*787/i, "B788"],
  // Wide Body
  [/airbus\s*a300-?600|a300/i, "A306"], [/boeing\s*767-?300er|767-?300/i, "B763"],
  [/airbus\s*a330-?200f/i, "A332"], [/airbus\s*a330-?900neo|a330-?900/i, "A339"],
  [/airbus\s*a330-?300|a330/i, "A333"],
  [/boeing\s*747-?400|747-?400/i, "B744"], [/boeing\s*747-?8f|747-?8f/i, "B748"], [/boeing\s*747-?8|747-?8/i, "B748"],
  [/boeing\s*777-?200er|777-?200/i, "B772"], [/boeing\s*777-?300er|777-?300/i, "B773"],
  [/boeing\s*777f/i, "B77L"], [/boeing\s*777/i, "B772"],
  [/airbus\s*a350-?900|a350/i, "A359"], [/airbus\s*a350-?1000|a35k/i, "A35K"],
  [/airbus\s*a380/i, "A388"], [/concorde/i, "CONC"],
];

/**
 * Resolve a realistic max cruise speed (knots TAS) from a marketplace aircraft model name and/or category.
 * @param {string|null} modelName - Display name like "Boeing 737-800"
 * @param {string|null} fleetAircraftType - Category fallback (small_prop, turboprop, ...)
 * @returns {number} Cruise speed in knots
 */
export function getCruiseSpeedForModel(modelName, fleetAircraftType) {
  const name = String(modelName || "");
  if (name) {
    for (const [pattern, icao] of MODEL_NAME_TO_ICAO) {
      if (pattern.test(name)) {
        const speed = aircraftCruiseSpeeds[icao];
        if (speed) return speed;
      }
    }
  }
  if (fleetAircraftType && categoryFallbackSpeeds[fleetAircraftType]) {
    return categoryFallbackSpeeds[fleetAircraftType];
  }
  return 250;
}