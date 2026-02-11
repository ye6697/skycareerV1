// Mapping of X-Plane aircraft ICAO type codes to realistic cruise speeds (in knots TAS)
// Used for dynamic deadline calculation based on the actual aircraft being flown in X-Plane

const aircraftCruiseSpeeds = {
  // ---- Small Props ----
  "C172": 122, "C182": 145, "C206": 155, "C208": 185, "C210": 165,
  "PA28": 125, "PA32": 155, "PA34": 170, "PA46": 215, "BE36": 175,
  "BE58": 200, "M20T": 195, "SR22": 185, "DA40": 147, "DA42": 190,
  "P28A": 125, "P32R": 160, "BE35": 170, "C150": 105, "C152": 110,
  "RV7": 185, "RV10": 195, "P28R": 155, "PA24": 160, "C177": 130,
  "C185": 155, "PA18": 100, "PA22": 120, "DV20": 120, "VENT": 100,

  // ---- Turboprops ----
  "B350": 310, "PC12": 280, "C90": 245, "BE20": 290, "TBM9": 330,
  "TBM8": 320, "TBM7": 300, "AT76": 275, "AT75": 270, "AT72": 275,
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

  // ---- Wide Body Jets ----
  "A332": 480, "A333": 480, "A338": 480, "A339": 480, "A342": 475,
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