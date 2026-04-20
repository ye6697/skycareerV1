import { ADDITIONAL_AIRPORT_COORDS } from './additionalAirportCoordinates';

const AIRPORT_COORDS = {
  // ========== EUROPE ==========
  // Germany
  EDDB: { lat: 52.3667, lon: 13.5033 }, // Berlin Brandenburg
  EDDC: { lat: 51.1346, lon: 13.7672 }, // Dresden
  EDDE: { lat: 50.9798, lon: 10.9581 }, // Erfurt
  EDDF: { lat: 50.0379, lon: 8.5622 }, // Frankfurt Main
  EDDG: { lat: 52.1346, lon: 7.6848 }, // Münster/Osnabrück
  EDDH: { lat: 53.6304, lon: 9.9882 }, // Hamburg
  EDDK: { lat: 50.8659, lon: 7.1427 }, // Köln/Bonn
  EDDL: { lat: 51.2895, lon: 6.7668 }, // Düsseldorf
  EDDM: { lat: 48.3538, lon: 11.7861 }, // München
  EDDN: { lat: 49.4987, lon: 11.0669 }, // Nürnberg
  EDDP: { lat: 51.4324, lon: 12.2416 }, // Leipzig/Halle
  EDDR: { lat: 49.2146, lon: 7.1095 }, // Saarbrücken
  EDDS: { lat: 48.6899, lon: 9.2219 }, // Stuttgart
  EDDT: { lat: 52.5597, lon: 13.2877 }, // Berlin Tegel (closed but in sim)
  EDDV: { lat: 52.4611, lon: 9.6851 }, // Hannover
  EDDW: { lat: 53.0475, lon: 8.7867 }, // Bremen
  EDHL: { lat: 53.8054, lon: 10.7192 }, // Lübeck
  EDLP: { lat: 51.6141, lon: 8.6163 }, // Paderborn
  EDLW: { lat: 51.5183, lon: 7.6122 }, // Dortmund
  EDNY: { lat: 47.6713, lon: 9.5115 }, // Friedrichshafen
  EDQM: { lat: 49.4732, lon: 11.9196 }, // Hof-Plauen
  EDSB: { lat: 48.7793, lon: 8.0805 }, // Karlsruhe/Baden-Baden

  // UK & Ireland
  EGBB: { lat: 52.4539, lon: -1.7480 }, // Birmingham
  EGCC: { lat: 53.3537, lon: -2.2750 }, // Manchester
  EGFF: { lat: 51.3967, lon: -3.3433 }, // Cardiff
  EGGD: { lat: 51.3827, lon: -2.7191 }, // Bristol
  EGGP: { lat: 53.3336, lon: -2.8497 }, // Liverpool
  EGGW: { lat: 51.8747, lon: -0.3683 }, // London Luton
  EGHI: { lat: 50.9503, lon: -1.3568 }, // Southampton
  EGJJ: { lat: 49.2080, lon: -2.1955 }, // Jersey
  EGKK: { lat: 51.1537, lon: -0.1821 }, // London Gatwick
  EGLL: { lat: 51.4700, lon: -0.4543 }, // London Heathrow
  EGMC: { lat: 51.5714, lon: 0.6956 }, // London Southend
  EGNM: { lat: 53.8659, lon: -1.6606 }, // Leeds Bradford
  EGNX: { lat: 52.8311, lon: -1.3281 }, // East Midlands
  EGPD: { lat: 57.2019, lon: -2.1978 }, // Aberdeen
  EGPF: { lat: 55.8719, lon: -4.4331 }, // Glasgow
  EGPH: { lat: 55.9500, lon: -3.3725 }, // Edinburgh
  EGSS: { lat: 51.8850, lon: 0.2350 }, // London Stansted
  EGTE: { lat: 50.7344, lon: -3.4139 }, // Exeter
  EIDW: { lat: 53.4213, lon: -6.2701 }, // Dublin
  EICK: { lat: 51.8413, lon: -8.4911 }, // Cork
  EINN: { lat: 52.7020, lon: -8.9248 }, // Shannon
  EGAA: { lat: 54.6575, lon: -6.2158 }, // Belfast Intl

  // France
  LFBD: { lat: 44.8283, lon: -0.7156 }, // Bordeaux
  LFBH: { lat: 46.1792, lon: -1.1953 }, // La Rochelle
  LFBI: { lat: 46.5877, lon: 0.3066 }, // Poitiers
  LFBO: { lat: 43.6291, lon: 1.3638 }, // Toulouse
  LFBT: { lat: 43.1787, lon: -0.0064 }, // Pau
  LFJL: { lat: 48.9822, lon: 6.2513 }, // Metz-Nancy
  LFKB: { lat: 42.5527, lon: 9.4838 }, // Bastia
  LFKJ: { lat: 41.9236, lon: 8.8029 }, // Ajaccio
  LFLL: { lat: 45.7256, lon: 5.0811 }, // Lyon
  LFLP: { lat: 45.9281, lon: 6.0987 }, // Annecy
  LFLS: { lat: 45.3629, lon: 5.3294 }, // Grenoble
  LFML: { lat: 43.4393, lon: 5.2214 }, // Marseille
  LFMN: { lat: 43.6653, lon: 7.2150 }, // Nice
  LFMP: { lat: 42.7403, lon: 2.8706 }, // Perpignan
  LFMT: { lat: 43.5762, lon: 3.9630 }, // Montpellier
  LFOB: { lat: 49.4544, lon: 2.1128 }, // Beauvais
  LFPG: { lat: 49.0097, lon: 2.5479 }, // Paris CDG
  LFPO: { lat: 48.7253, lon: 2.3594 }, // Paris Orly
  LFRB: { lat: 48.4479, lon: -4.4186 }, // Brest
  LFRN: { lat: 48.0695, lon: -1.7348 }, // Rennes
  LFRS: { lat: 47.1532, lon: -1.6107 }, // Nantes
  LFSB: { lat: 47.5896, lon: 7.5299 }, // Basel-Mulhouse
  LFST: { lat: 48.5383, lon: 7.6282 }, // Strasbourg

  // Netherlands, Belgium, Luxembourg
  EHAM: { lat: 52.3086, lon: 4.7639 }, // Amsterdam Schiphol
  EHBK: { lat: 50.9117, lon: 5.7706 }, // Maastricht
  EHEH: { lat: 51.4501, lon: 5.3745 }, // Eindhoven
  EHRD: { lat: 51.9569, lon: 4.4372 }, // Rotterdam
  EBBR: { lat: 50.9014, lon: 4.4844 }, // Brussels
  EBCI: { lat: 50.4592, lon: 4.4538 }, // Charleroi
  EBLG: { lat: 50.6374, lon: 5.4432 }, // Liège
  ELLX: { lat: 49.6233, lon: 6.2044 }, // Luxembourg

  // Scandinavia
  EKCH: { lat: 55.6180, lon: 12.6560 }, // Copenhagen
  EKBI: { lat: 55.7403, lon: 9.1518 }, // Billund
  ENGM: { lat: 60.1976, lon: 11.1004 }, // Oslo Gardermoen
  ENBR: { lat: 60.2934, lon: 5.2181 }, // Bergen
  ENVA: { lat: 63.4578, lon: 10.9240 }, // Trondheim
  ENTC: { lat: 69.6833, lon: 18.9189 }, // Tromsø
  ENZV: { lat: 58.8767, lon: 5.6378 }, // Stavanger
  ESSA: { lat: 59.6519, lon: 17.9186 }, // Stockholm Arlanda
  ESGG: { lat: 57.6628, lon: 12.2798 }, // Göteborg
  ESMS: { lat: 55.5363, lon: 13.3762 }, // Malmö
  EFHK: { lat: 60.3172, lon: 24.9633 }, // Helsinki
  EFRO: { lat: 66.5648, lon: 25.8304 }, // Rovaniemi
  EFTP: { lat: 61.4141, lon: 23.6044 }, // Tampere
  EFTU: { lat: 60.5141, lon: 22.2628 }, // Turku
  BIRK: { lat: 64.1300, lon: -21.9406 }, // Reykjavik
  BIKF: { lat: 63.9850, lon: -22.6056 }, // Keflavik
  BIAR: { lat: 65.6600, lon: -18.0727 }, // Akureyri

  // Baltic States
  EETN: { lat: 59.4133, lon: 24.8328 }, // Tallinn
  EVRA: { lat: 56.9236, lon: 23.9711 }, // Riga
  EYVI: { lat: 54.6341, lon: 25.2858 }, // Vilnius
  EYKA: { lat: 54.9639, lon: 24.0848 }, // Kaunas

  // Spain & Portugal
  LEBL: { lat: 41.2974, lon: 2.0833 }, // Barcelona
  LEMD: { lat: 40.4983, lon: -3.5676 }, // Madrid Barajas
  LEPA: { lat: 39.5517, lon: 2.7388 }, // Palma de Mallorca
  LEAL: { lat: 38.2822, lon: -0.5582 }, // Alicante
  LEBB: { lat: 43.3011, lon: -2.9106 }, // Bilbao
  LEGR: { lat: 37.1887, lon: -3.7774 }, // Granada
  LEIB: { lat: 38.8729, lon: 1.3731 }, // Ibiza
  LEJR: { lat: 36.7446, lon: -6.0601 }, // Jerez
  LEMG: { lat: 36.6749, lon: -4.4991 }, // Málaga
  LEST: { lat: 42.8963, lon: -8.4152 }, // Santiago de Compostela
  LEVC: { lat: 39.4893, lon: -0.4816 }, // Valencia
  LEZL: { lat: 37.4180, lon: -5.8931 }, // Sevilla
  GCFV: { lat: 28.4527, lon: -13.8638 }, // Fuerteventura
  GCHI: { lat: 27.8148, lon: -17.8871 }, // El Hierro
  GCLP: { lat: 27.9319, lon: -15.3866 }, // Gran Canaria
  GCRR: { lat: 28.9455, lon: -13.6052 }, // Lanzarote
  GCTS: { lat: 28.0445, lon: -16.5725 }, // Tenerife South
  GCXO: { lat: 28.4827, lon: -16.3415 }, // Tenerife North
  LPFR: { lat: 37.0144, lon: -7.9659 }, // Faro
  LPMA: { lat: 32.6979, lon: -16.7745 }, // Madeira
  LPPR: { lat: 41.2481, lon: -8.6814 }, // Porto
  LPPT: { lat: 38.7813, lon: -9.1359 }, // Lissabon
  LPPS: { lat: 38.5689, lon: -28.7163 }, // Ponta Delgada (Azores)

  // Italy
  LICA: { lat: 37.4668, lon: 15.0664 }, // Catania
  LICJ: { lat: 38.1760, lon: 13.0910 }, // Palermo
  LIEA: { lat: 40.6321, lon: 8.2908 }, // Alghero
  LIEE: { lat: 39.2515, lon: 9.0543 }, // Cagliari
  LIME: { lat: 45.6689, lon: 9.7004 }, // Bergamo
  LIMC: { lat: 45.6301, lon: 8.7281 }, // Mailand Malpensa
  LIMF: { lat: 45.2008, lon: 7.6497 }, // Turin
  LIPE: { lat: 44.5354, lon: 11.2887 }, // Bologna
  LIPX: { lat: 45.3957, lon: 10.8885 }, // Verona
  LIPZ: { lat: 45.5053, lon: 12.3519 }, // Venedig
  LIRA: { lat: 41.7994, lon: 12.5949 }, // Rom Ciampino
  LIRF: { lat: 41.8003, lon: 12.2389 }, // Rom Fiumicino
  LIRN: { lat: 40.8861, lon: 14.2908 }, // Neapel
  LIRP: { lat: 43.6839, lon: 10.3927 }, // Pisa
  LIRQ: { lat: 43.8100, lon: 11.2051 }, // Florenz

  // Switzerland & Austria
  LSGG: { lat: 46.2381, lon: 6.1089 }, // Genf
  LSZB: { lat: 46.9141, lon: 7.4972 }, // Bern
  LSZH: { lat: 47.4647, lon: 8.5492 }, // Zürich
  LOWI: { lat: 47.2602, lon: 11.3439 }, // Innsbruck
  LOWG: { lat: 46.9911, lon: 15.4396 }, // Graz
  LOWK: { lat: 46.6425, lon: 14.3377 }, // Klagenfurt
  LOWL: { lat: 48.2332, lon: 14.1875 }, // Linz
  LOWS: { lat: 47.7933, lon: 13.0043 }, // Salzburg
  LOWW: { lat: 48.1103, lon: 16.5697 }, // Wien

  // Central & Eastern Europe
  LKPR: { lat: 50.1008, lon: 14.2600 }, // Prag
  LKTB: { lat: 49.1513, lon: 16.6944 }, // Brünn
  LHBP: { lat: 47.4399, lon: 19.2619 }, // Budapest
  EPGD: { lat: 54.3776, lon: 18.4662 }, // Gdansk
  EPKK: { lat: 50.0777, lon: 19.7848 }, // Krakau
  EPKT: { lat: 50.4743, lon: 19.0800 }, // Katowice
  EPPO: { lat: 52.4211, lon: 16.8263 }, // Posen
  EPWA: { lat: 52.1657, lon: 20.9671 }, // Warschau
  EPWR: { lat: 51.1027, lon: 16.8858 }, // Breslau
  LZIB: { lat: 48.1702, lon: 17.2127 }, // Bratislava
  LZKZ: { lat: 48.6631, lon: 21.2411 }, // Košice
  LJLJ: { lat: 46.2237, lon: 14.4576 }, // Ljubljana
  LDZA: { lat: 45.7429, lon: 16.0688 }, // Zagreb
  LDSP: { lat: 43.5389, lon: 16.2980 }, // Split
  LDDU: { lat: 42.5614, lon: 18.2682 }, // Dubrovnik
  LQSA: { lat: 43.8246, lon: 18.3315 }, // Sarajevo
  LYBE: { lat: 44.8184, lon: 20.3091 }, // Belgrad
  LWSK: { lat: 41.9616, lon: 21.6214 }, // Skopje
  LATN: { lat: 41.4147, lon: 19.7206 }, // Tirana
  BKPR: { lat: 42.5728, lon: 21.0358 }, // Pristina

  // Romania & Bulgaria
  LROP: { lat: 44.5711, lon: 26.0850 }, // Bukarest Otopeni
  LRCL: { lat: 46.7852, lon: 23.6862 }, // Cluj-Napoca
  LRTR: { lat: 45.8099, lon: 21.3379 }, // Timișoara
  LRIA: { lat: 47.1785, lon: 27.6206 }, // Iași
  LRBS: { lat: 44.5035, lon: 26.1021 }, // Bukarest Baneasa
  LBSF: { lat: 42.6967, lon: 23.4114 }, // Sofia
  LBBG: { lat: 42.5696, lon: 27.5152 }, // Burgas
  LBWN: { lat: 43.2322, lon: 27.8251 }, // Varna

  // Greece & Cyprus
  LGAV: { lat: 37.9364, lon: 23.9475 }, // Athen
  LGIR: { lat: 35.3397, lon: 25.1803 }, // Heraklion/Kreta
  LGTS: { lat: 40.5197, lon: 22.9709 }, // Thessaloniki
  LGKR: { lat: 39.6019, lon: 19.9117 }, // Korfu
  LGKO: { lat: 36.7933, lon: 27.0917 }, // Kos
  LGMK: { lat: 37.4351, lon: 25.3481 }, // Mykonos
  LGRP: { lat: 36.4054, lon: 28.0862 }, // Rhodos
  LGSR: { lat: 36.3992, lon: 25.4793 }, // Santorini
  LGZA: { lat: 37.7509, lon: 20.8843 }, // Zakynthos
  LCLK: { lat: 34.8751, lon: 33.6249 }, // Larnaka
  LCPH: { lat: 34.7180, lon: 32.4857 }, // Paphos

  // Turkey
  LTAC: { lat: 40.1281, lon: 32.9951 }, // Ankara Esenboga
  LTAI: { lat: 36.8987, lon: 30.8005 }, // Antalya
  LTBA: { lat: 40.9769, lon: 28.8146 }, // Istanbul Atatürk
  LTBS: { lat: 37.2505, lon: 28.3643 }, // Dalaman
  LTBJ: { lat: 38.2924, lon: 27.1570 }, // Izmir
  LTFM: { lat: 41.2753, lon: 28.7519 }, // Istanbul
  LTFE: { lat: 36.7131, lon: 29.5897 }, // Dalaman/Fethiye

  // ========== NORTH AMERICA ==========
  // USA - Major Hubs
  KATL: { lat: 33.6367, lon: -84.4281 }, // Atlanta
  KBOS: { lat: 42.3656, lon: -71.0096 }, // Boston
  KBWI: { lat: 39.1754, lon: -76.6684 }, // Baltimore
  KCLE: { lat: 41.4117, lon: -81.8498 }, // Cleveland
  KCLT: { lat: 35.2140, lon: -80.9431 }, // Charlotte
  KCVG: { lat: 39.0488, lon: -84.6678 }, // Cincinnati
  KDCA: { lat: 38.8521, lon: -77.0377 }, // Washington Reagan
  KDEN: { lat: 39.8561, lon: -104.6737 }, // Denver
  KDFW: { lat: 32.8998, lon: -97.0403 }, // Dallas/Fort Worth
  KDTW: { lat: 42.2124, lon: -83.3534 }, // Detroit
  KEWR: { lat: 40.6925, lon: -74.1687 }, // Newark
  KFLL: { lat: 26.0726, lon: -80.1527 }, // Fort Lauderdale
  KHOU: { lat: 29.6454, lon: -95.2789 }, // Houston Hobby
  KIAD: { lat: 38.9445, lon: -77.4558 }, // Washington Dulles
  KIAH: { lat: 29.9844, lon: -95.3414 }, // Houston IAH
  KJFK: { lat: 40.6413, lon: -73.7781 }, // New York JFK
  KLAS: { lat: 36.0840, lon: -115.1537 }, // Las Vegas
  KLAX: { lat: 33.9416, lon: -118.4085 }, // Los Angeles
  KLGA: { lat: 40.7772, lon: -73.8726 }, // New York LaGuardia
  KMCI: { lat: 39.2976, lon: -94.7139 }, // Kansas City
  KMCO: { lat: 28.4294, lon: -81.3090 }, // Orlando
  KMDW: { lat: 41.7868, lon: -87.7524 }, // Chicago Midway
  KMEM: { lat: 35.0424, lon: -89.9767 }, // Memphis
  KMIA: { lat: 25.7959, lon: -80.2870 }, // Miami
  KMKE: { lat: 42.9472, lon: -87.8966 }, // Milwaukee
  KMSP: { lat: 44.8820, lon: -93.2218 }, // Minneapolis
  KMSN: { lat: 43.1399, lon: -89.3375 }, // Madison
  KMSY: { lat: 29.9934, lon: -90.2580 }, // New Orleans
  KORD: { lat: 41.9742, lon: -87.9073 }, // Chicago O'Hare
  KPDX: { lat: 45.5887, lon: -122.5975 }, // Portland
  KPHL: { lat: 39.8721, lon: -75.2411 }, // Philadelphia
  KPHX: { lat: 33.4373, lon: -112.0078 }, // Phoenix
  KPIT: { lat: 40.4915, lon: -80.2329 }, // Pittsburgh
  KRDU: { lat: 35.8776, lon: -78.7875 }, // Raleigh-Durham
  KRSW: { lat: 26.5362, lon: -81.7552 }, // Fort Myers
  KSAN: { lat: 32.7336, lon: -117.1897 }, // San Diego
  KSAT: { lat: 29.5337, lon: -98.4698 }, // San Antonio
  KSDF: { lat: 38.1741, lon: -85.7360 }, // Louisville
  KSEA: { lat: 47.4502, lon: -122.3088 }, // Seattle
  KSFO: { lat: 37.6213, lon: -122.3790 }, // San Francisco
  KSJC: { lat: 37.3626, lon: -121.9291 }, // San Jose
  KSLC: { lat: 40.7884, lon: -111.9778 }, // Salt Lake City
  KSMF: { lat: 38.6954, lon: -121.5908 }, // Sacramento
  KSNA: { lat: 33.6757, lon: -117.8682 }, // Santa Ana/John Wayne
  KSTL: { lat: 38.7487, lon: -90.3700 }, // St. Louis
  KTPA: { lat: 27.9755, lon: -82.5332 }, // Tampa
  KTUS: { lat: 32.1161, lon: -110.9410 }, // Tucson
  PAFA: { lat: 64.8151, lon: -147.8561 }, // Fairbanks
  PANC: { lat: 61.1743, lon: -149.9983 }, // Anchorage
  PHNL: { lat: 21.3187, lon: -157.9225 }, // Honolulu
  PHKO: { lat: 19.7388, lon: -156.0456 }, // Kona
  PHOG: { lat: 20.8986, lon: -156.4305 }, // Maui Kahului
  TJSJ: { lat: 18.4394, lon: -66.0018 }, // San Juan Puerto Rico

  // USA - Scenic & GA
  KASE: { lat: 39.2232, lon: -106.8688 }, // Aspen
  KEGE: { lat: 39.6426, lon: -106.9159 }, // Eagle/Vail
  KJAC: { lat: 43.6073, lon: -110.7377 }, // Jackson Hole
  KSUN: { lat: 43.5044, lon: -114.2962 }, // Sun Valley
  KMMH: { lat: 37.6241, lon: -118.8378 }, // Mammoth Lakes
  KSBP: { lat: 35.2368, lon: -120.6424 }, // San Luis Obispo
  KMRY: { lat: 36.5870, lon: -121.8430 }, // Monterey
  KFHR: { lat: 48.5220, lon: -123.0244 }, // Friday Harbor
  KAVL: { lat: 35.4362, lon: -82.5418 }, // Asheville
  KBZN: { lat: 45.7775, lon: -111.1530 }, // Bozeman
  KCYS: { lat: 41.1557, lon: -104.8118 }, // Cheyenne
  KSEZ: { lat: 34.8486, lon: -111.7884 }, // Sedona

  // Canada
  CYEG: { lat: 53.3097, lon: -113.5797 }, // Edmonton
  CYHZ: { lat: 44.8808, lon: -63.5086 }, // Halifax
  CYOW: { lat: 45.3225, lon: -75.6692 }, // Ottawa
  CYQB: { lat: 46.7911, lon: -71.3934 }, // Quebec City
  CYQR: { lat: 50.4319, lon: -104.6658 }, // Regina
  CYUL: { lat: 45.4706, lon: -73.7408 }, // Montreal
  CYVR: { lat: 49.1951, lon: -123.1779 }, // Vancouver
  CYWG: { lat: 49.9100, lon: -97.2399 }, // Winnipeg
  CYXE: { lat: 52.1708, lon: -106.6997 }, // Saskatoon
  CYYZ: { lat: 43.6777, lon: -79.6248 }, // Toronto Pearson
  CYTZ: { lat: 43.6275, lon: -79.3962 }, // Toronto City Billy Bishop
  CYYC: { lat: 51.1215, lon: -114.0076 }, // Calgary
  CYYJ: { lat: 48.6469, lon: -123.4258 }, // Victoria

  // Mexico
  MMMX: { lat: 19.4361, lon: -99.0719 }, // Mexico City
  MMUN: { lat: 21.0365, lon: -86.8771 }, // Cancún
  MMGL: { lat: 20.5218, lon: -103.3111 }, // Guadalajara
  MMMY: { lat: 25.7785, lon: -100.1069 }, // Monterrey
  MMTJ: { lat: 32.5411, lon: -116.9703 }, // Tijuana
  MMCZ: { lat: 20.5224, lon: -86.9256 }, // Cozumel
  MMPR: { lat: 20.6801, lon: -105.2544 }, // Puerto Vallarta
  MMSD: { lat: 23.1518, lon: -109.7211 }, // San José del Cabo

  // Caribbean
  MKJP: { lat: 17.9357, lon: -76.7875 }, // Kingston Jamaica
  MBPV: { lat: 21.7736, lon: -72.2659 }, // Providenciales
  TBPB: { lat: 13.0746, lon: -59.4925 }, // Barbados
  TFFR: { lat: 16.2653, lon: -61.5318 }, // Guadeloupe
  TFFF: { lat: 14.5910, lon: -61.0032 }, // Martinique
  TIST: { lat: 18.3373, lon: -64.9734 }, // St. Thomas
  TLPC: { lat: 14.0202, lon: -60.9926 }, // St. Lucia
  TNCA: { lat: 12.5014, lon: -70.0152 }, // Aruba
  TNCB: { lat: 12.1309, lon: -68.2685 }, // Bonaire
  TNCM: { lat: 18.0410, lon: -63.1089 }, // St. Maarten
  TTPP: { lat: 10.5953, lon: -61.3372 }, // Trinidad

  // ========== CENTRAL & SOUTH AMERICA ==========
  MGGT: { lat: 14.5833, lon: -90.5275 }, // Guatemala City
  MHLM: { lat: 15.4526, lon: -87.9236 }, // San Pedro Sula
  MNMG: { lat: 12.1415, lon: -86.1682 }, // Managua
  MPPA: { lat: 9.0714, lon: -79.3835 }, // Panama City
  MROC: { lat: 9.9939, lon: -84.2088 }, // San José Costa Rica
  MSLP: { lat: 13.4409, lon: -89.0557 }, // San Salvador
  SAEZ: { lat: -34.8222, lon: -58.5358 }, // Buenos Aires Ezeiza
  SABE: { lat: -34.5592, lon: -58.4156 }, // Buenos Aires Aeroparque
  SACO: { lat: -31.3236, lon: -64.2081 }, // Córdoba AR
  SAME: { lat: -32.8317, lon: -68.7929 }, // Mendoza
  SBAF: { lat: -22.8750, lon: -43.3847 }, // Rio de Janeiro (Alt)
  SBBR: { lat: -15.8711, lon: -47.9186 }, // Brasilia
  SBCF: { lat: -19.6244, lon: -43.9719 }, // Belo Horizonte
  SBCT: { lat: -25.5285, lon: -49.1758 }, // Curitiba
  SBFL: { lat: -27.6703, lon: -48.5525 }, // Florianópolis
  SBFZ: { lat: -3.7763, lon: -38.5326 }, // Fortaleza
  SBGL: { lat: -22.8099, lon: -43.2506 }, // Rio de Janeiro Galeão
  SBGR: { lat: -23.4356, lon: -46.4731 }, // São Paulo Guarulhos
  SBKP: { lat: -23.0075, lon: -47.1345 }, // Campinas
  SBPA: { lat: -29.9944, lon: -51.1714 }, // Porto Alegre
  SBRE: { lat: -8.1265, lon: -34.9236 }, // Recife
  SBRF: { lat: -8.1265, lon: -34.9236 }, // Recife (alt code)
  SBSP: { lat: -23.6261, lon: -46.6564 }, // São Paulo Congonhas
  SBSV: { lat: -12.9086, lon: -38.3225 }, // Salvador
  SCEL: { lat: -33.3930, lon: -70.7858 }, // Santiago Chile
  SEQM: { lat: -0.1292, lon: -78.3575 }, // Quito
  SEGU: { lat: -2.1574, lon: -79.8837 }, // Guayaquil
  SKBO: { lat: 4.7016, lon: -74.1469 }, // Bogotá
  SKCL: { lat: 3.5431, lon: -76.3816 }, // Cali
  SKMD: { lat: 6.1645, lon: -75.4231 }, // Medellín
  SLLP: { lat: -16.5133, lon: -68.1923 }, // La Paz
  SPJC: { lat: -12.0219, lon: -77.1143 }, // Lima
  SPZO: { lat: -13.5357, lon: -71.9388 }, // Cusco
  SUMU: { lat: -34.8384, lon: -56.0308 }, // Montevideo
  SVMI: { lat: 10.6012, lon: -66.9906 }, // Caracas

  // ========== AFRICA ==========
  DAAG: { lat: 36.6910, lon: 3.2154 }, // Algier
  DTTA: { lat: 36.8510, lon: 10.2272 }, // Tunis
  DTNH: { lat: 35.7581, lon: 10.7547 }, // Monastir
  FACT: { lat: -33.9696, lon: 18.5972 }, // Kapstadt
  FALE: { lat: -29.6144, lon: 31.1197 }, // Durban
  FAOR: { lat: -26.1337, lon: 28.2420 }, // Johannesburg
  FBSK: { lat: -24.5553, lon: 25.9182 }, // Gaborone
  FMMI: { lat: -18.7969, lon: 47.4789 }, // Antananarivo
  FMEE: { lat: -20.8872, lon: 55.5103 }, // Réunion
  FQMA: { lat: -25.9208, lon: 32.5726 }, // Maputo
  GABS: { lat: 14.7395, lon: -17.4903 }, // Dakar
  GMMN: { lat: 33.3675, lon: -7.5899 }, // Casablanca
  GMME: { lat: 34.0515, lon: -6.7515 }, // Rabat
  GMMX: { lat: 31.6069, lon: -8.0363 }, // Marrakesch
  GOOY: { lat: 14.7395, lon: -17.4903 }, // Dakar (alt)
  HAAB: { lat: 8.9779, lon: 38.7993 }, // Addis Abeba
  HCMM: { lat: 2.0144, lon: 45.3047 }, // Mogadischu
  HDAM: { lat: 11.5473, lon: 43.1594 }, // Dschibuti
  HECA: { lat: 30.1219, lon: 31.4056 }, // Kairo
  HEGN: { lat: 27.1784, lon: 33.7994 }, // Hurghada
  HEMA: { lat: 25.5571, lon: 34.5837 }, // Luxor
  HESH: { lat: 27.9773, lon: 34.3950 }, // Sharm el-Sheikh
  HKJK: { lat: -1.3192, lon: 36.9278 }, // Nairobi
  HKMO: { lat: -4.0348, lon: 39.5942 }, // Mombasa
  HRYR: { lat: -1.9686, lon: 30.1395 }, // Kigali
  HTDA: { lat: -6.8781, lon: 39.2026 }, // Dar es Salaam
  HTKJ: { lat: -3.4294, lon: 37.0745 }, // Kilimanjaro
  HUEN: { lat: 0.0424, lon: 32.4435 }, // Entebbe
  FZAA: { lat: -4.3858, lon: 15.4446 }, // Kinshasa
  DNMM: { lat: 6.5774, lon: 3.3211 }, // Lagos
  DNAA: { lat: 9.0065, lon: 7.2632 }, // Abuja
  DGAA: { lat: 5.6052, lon: -0.1668 }, // Accra
  DIII: { lat: 5.2614, lon: -3.9262 }, // Abidjan
  FLKK: { lat: -15.3310, lon: 28.4526 }, // Lusaka
  FVHA: { lat: -17.9318, lon: 31.0928 }, // Harare
  FWKI: { lat: -13.7894, lon: 33.7811 }, // Lilongwe
  FIMP: { lat: -20.4302, lon: 57.6836 }, // Mauritius

  // ========== MIDDLE EAST ==========
  LLBG: { lat: 32.0114, lon: 34.8867 }, // Tel Aviv
  OBBI: { lat: 26.2708, lon: 50.6336 }, // Bahrain
  OEJN: { lat: 21.6796, lon: 39.1565 }, // Jeddah
  OERK: { lat: 24.9576, lon: 46.6988 }, // Riad
  OERR: { lat: 24.7103, lon: 46.7253 }, // Riad (King Khalid)
  OIIE: { lat: 35.4161, lon: 51.1522 }, // Teheran
  OISS: { lat: 29.5392, lon: 52.5899 }, // Shiraz
  OJAI: { lat: 31.7226, lon: 35.9932 }, // Amman
  OKBK: { lat: 29.2266, lon: 47.9689 }, // Kuwait
  OMAA: { lat: 24.4330, lon: 54.6511 }, // Abu Dhabi
  OMDB: { lat: 25.2532, lon: 55.3657 }, // Dubai
  OMDW: { lat: 24.8967, lon: 55.1614 }, // Al Maktoum/Dubai World
  OMSJ: { lat: 25.3286, lon: 55.5172 }, // Sharjah
  ORMM: { lat: 30.5491, lon: 47.6621 }, // Basra
  ORBI: { lat: 33.2625, lon: 44.2346 }, // Baghdad
  OSDI: { lat: 33.4115, lon: 36.5156 }, // Damaskus
  OTHH: { lat: 25.2731, lon: 51.6081 }, // Doha
  OYAA: { lat: 15.4764, lon: 44.2197 }, // Sanaa
  OOMS: { lat: 23.5933, lon: 58.2844 }, // Muscat

  // ========== RUSSIA & CIS ==========
  UAAA: { lat: 43.3521, lon: 77.0405 }, // Almaty
  UACC: { lat: 51.0222, lon: 71.4669 }, // Nur-Sultan/Astana
  UBBB: { lat: 40.4675, lon: 50.0467 }, // Baku
  UDYZ: { lat: 40.1473, lon: 44.3959 }, // Yerevan
  UGGG: { lat: 41.6692, lon: 44.9547 }, // Tiflis/Tbilisi
  UKBB: { lat: 50.3450, lon: 30.8947 }, // Kiew Boryspil
  UKLL: { lat: 49.8125, lon: 23.9561 }, // Lwiw
  UKOO: { lat: 46.4268, lon: 30.6765 }, // Odessa
  ULLI: { lat: 59.8003, lon: 30.2625 }, // St. Petersburg
  UMMS: { lat: 53.8825, lon: 28.0307 }, // Minsk
  UNNT: { lat: 55.0125, lon: 82.6507 }, // Nowosibirsk
  URSS: { lat: 43.4499, lon: 39.9566 }, // Sotschi
  USSS: { lat: 56.7431, lon: 60.8028 }, // Jekaterinburg
  UUDD: { lat: 55.4088, lon: 37.9063 }, // Moskau Domodedovo
  UUEE: { lat: 55.9726, lon: 37.4146 }, // Moskau Scheremetjewo
  UUWW: { lat: 55.5915, lon: 37.2615 }, // Moskau Wnukowo
  UWKD: { lat: 55.6062, lon: 49.2787 }, // Kasan
  UWWW: { lat: 53.5040, lon: 50.1643 }, // Samara
  UTTT: { lat: 41.2579, lon: 69.2812 }, // Taschkent

  // ========== ASIA ==========
  // China
  ZBAA: { lat: 40.0799, lon: 116.6031 }, // Peking Capital
  ZBAD: { lat: 39.5098, lon: 116.4105 }, // Peking Daxing
  ZGGG: { lat: 23.3924, lon: 113.2988 }, // Guangzhou
  ZGHA: { lat: 28.1892, lon: 113.2200 }, // Changsha
  ZHCC: { lat: 34.5197, lon: 113.8409 }, // Zhengzhou
  ZJHK: { lat: 19.9349, lon: 110.4590 }, // Haikou
  ZJSY: { lat: 18.3029, lon: 109.4122 }, // Sanya
  ZKKJ: { lat: 36.2488, lon: 120.3744 }, // Qingdao (approx)
  ZKPY: { lat: 39.2241, lon: 125.6690 }, // Pjöngjang
  ZLXY: { lat: 34.4471, lon: 108.7516 }, // Xi'an
  ZPPP: { lat: 24.9924, lon: 102.7432 }, // Kunming
  ZSFZ: { lat: 25.9351, lon: 119.6633 }, // Fuzhou
  ZSAM: { lat: 24.5440, lon: 118.1278 }, // Xiamen
  ZSHC: { lat: 30.2295, lon: 120.4344 }, // Hangzhou
  ZSNJ: { lat: 31.7420, lon: 118.8622 }, // Nanjing
  ZSPD: { lat: 31.1443, lon: 121.8083 }, // Shanghai Pudong
  ZSSS: { lat: 31.1979, lon: 121.3363 }, // Shanghai Hongqiao
  ZUUU: { lat: 30.5785, lon: 103.9471 }, // Chengdu
  ZUCK: { lat: 29.7192, lon: 106.6422 }, // Chongqing
  ZWWW: { lat: 43.9071, lon: 87.4742 }, // Ürümqi
  ZYTL: { lat: 38.9657, lon: 121.5386 }, // Dalian
  ZYTX: { lat: 41.6398, lon: 123.4833 }, // Shenyang
  ZYCC: { lat: 43.9962, lon: 125.6850 }, // Changchun

  // Japan
  RJAA: { lat: 35.7720, lon: 140.3929 }, // Tokio Narita
  RJTT: { lat: 35.5494, lon: 139.7798 }, // Tokio Haneda
  RJBB: { lat: 34.4274, lon: 135.2441 }, // Osaka Kansai
  RJOO: { lat: 34.7855, lon: 135.4383 }, // Osaka Itami
  RJGG: { lat: 34.8584, lon: 136.8052 }, // Nagoya Chubu
  RJFF: { lat: 33.5859, lon: 130.4511 }, // Fukuoka
  RJCC: { lat: 42.7752, lon: 141.6925 }, // Sapporo New Chitose
  RJCH: { lat: 41.7700, lon: 140.8220 }, // Hakodate
  RJCB: { lat: 42.7332, lon: 143.2172 }, // Obihiro
  RJFK: { lat: 31.8034, lon: 131.0469 }, // Miyazaki (Kagoshima nearby)
  RJNK: { lat: 36.3946, lon: 136.4069 }, // Komatsu
  ROAH: { lat: 26.1958, lon: 127.6459 }, // Okinawa/Naha

  // Korea
  RKSI: { lat: 37.4602, lon: 126.4407 }, // Seoul Incheon
  RKSS: { lat: 37.5586, lon: 126.7906 }, // Seoul Gimpo
  RKPK: { lat: 35.1795, lon: 128.9382 }, // Busan Gimhae
  RKPC: { lat: 33.5104, lon: 126.4929 }, // Jeju

  // Southeast Asia
  RPLL: { lat: 14.5086, lon: 121.0198 }, // Manila
  RPVM: { lat: 10.3065, lon: 123.9792 }, // Cebu
  VABB: { lat: 19.0896, lon: 72.8656 }, // Mumbai
  VDPP: { lat: 11.5466, lon: 104.8441 }, // Phnom Penh
  VDSR: { lat: 13.4107, lon: 103.8130 }, // Siem Reap
  VHHH: { lat: 22.3080, lon: 113.9185 }, // Hong Kong
  VIDP: { lat: 28.5562, lon: 77.1000 }, // Delhi
  VLVT: { lat: 17.9883, lon: 102.5633 }, // Vientiane
  VMMC: { lat: 22.1496, lon: 113.5925 }, // Macau
  VNKT: { lat: 27.6966, lon: 85.3591 }, // Kathmandu
  VOBL: { lat: 13.1986, lon: 77.7066 }, // Bangalore
  VOCI: { lat: 10.1520, lon: 76.4019 }, // Kochi
  VOCL: { lat: 11.0368, lon: 76.0699 }, // Kozhikode
  VOHS: { lat: 17.2403, lon: 78.4294 }, // Hyderabad
  VOMM: { lat: 12.9941, lon: 80.1709 }, // Chennai
  VTBD: { lat: 13.9126, lon: 100.6068 }, // Bangkok Don Mueang
  VTBS: { lat: 13.6900, lon: 100.7501 }, // Bangkok Suvarnabhumi
  VTCC: { lat: 18.7668, lon: 98.9626 }, // Chiang Mai
  VTSP: { lat: 8.1132, lon: 98.3169 }, // Phuket
  VTSS: { lat: 6.9371, lon: 100.3930 }, // Hat Yai
  VTSM: { lat: 9.5478, lon: 100.0621 }, // Koh Samui
  VVDN: { lat: 16.0439, lon: 108.1992 }, // Da Nang
  VVNB: { lat: 21.2212, lon: 105.8072 }, // Hanoi Noi Bai
  VVTS: { lat: 10.8188, lon: 106.6519 }, // Ho-Chi-Minh-Stadt
  WADD: { lat: -8.7482, lon: 115.1672 }, // Bali Ngurah Rai
  WIII: { lat: -6.1256, lon: 106.6559 }, // Jakarta
  WICC: { lat: -6.9006, lon: 107.5764 }, // Bandung
  WIMM: { lat: 3.5589, lon: 98.6712 }, // Medan
  WITT: { lat: -0.8736, lon: 134.0569 }, // Jayapura (approx)
  WMKK: { lat: 2.7456, lon: 101.7072 }, // Kuala Lumpur
  WMKP: { lat: 5.2972, lon: 103.1033 }, // Penang
  WBKK: { lat: 5.9372, lon: 116.0513 }, // Kota Kinabalu
  WBGG: { lat: 1.4842, lon: 110.3471 }, // Kuching
  WSSS: { lat: 1.3644, lon: 103.9915 }, // Singapur

  // Taiwan
  RCTP: { lat: 25.0797, lon: 121.2328 }, // Taipei Taoyuan
  RCSS: { lat: 25.0694, lon: 121.5523 }, // Taipei Songshan

  // ========== OCEANIA ==========
  NZAA: { lat: -37.0082, lon: 174.7850 }, // Auckland
  NZCH: { lat: -43.4894, lon: 172.5324 }, // Christchurch
  NZQN: { lat: -45.0211, lon: 168.7392 }, // Queenstown
  NZWN: { lat: -41.3272, lon: 174.8053 }, // Wellington
  NFFN: { lat: -17.7554, lon: 177.4431 }, // Nadi/Fidschi
  NSFA: { lat: -13.8299, lon: -171.9978 }, // Apia/Samoa
  NTAA: { lat: -17.5537, lon: -149.6115 }, // Tahiti Faa'a
  YBBN: { lat: -27.3842, lon: 153.1175 }, // Brisbane
  YBCS: { lat: -16.8858, lon: 145.7553 }, // Cairns
  YMML: { lat: -37.6733, lon: 144.8433 }, // Melbourne
  YPPH: { lat: -31.9403, lon: 115.9672 }, // Perth
  YSSY: { lat: -33.9399, lon: 151.1753 }, // Sydney
  YPAD: { lat: -34.9450, lon: 138.5306 }, // Adelaide
  YPDN: { lat: -12.4147, lon: 130.8769 }, // Darwin
  YBCG: { lat: -28.1644, lon: 153.5047 }, // Gold Coast
  YBTL: { lat: -19.2525, lon: 146.7656 }, // Townsville

  // ========== ADDITIONAL POPULAR DESTINATIONS ==========
  // Morocco
  GMFF: { lat: 33.9273, lon: -4.9780 }, // Fès
  GMTA: { lat: 35.1714, lon: -3.8399 }, // Al Hoceima (Tetouan nearby)
  GMTT: { lat: 35.7269, lon: -5.9200 }, // Tanger

  // Malta, Montenegro, etc.
  LMML: { lat: 35.8575, lon: 14.4775 }, // Malta
  LYPG: { lat: 42.3594, lon: 19.2519 }, // Podgorica
  LYTI: { lat: 42.4047, lon: 18.7233 }, // Tivat

  // Additional Canary / Balearic
  LEAM: { lat: 36.8439, lon: -2.3701 }, // Almería
  LEMH: { lat: 39.8626, lon: 4.2186 }, // Menorca

  // Extra Asia
  RCFN: { lat: 22.9272, lon: 121.1019 }, // Taitung
  VDSV: { lat: 13.4107, lon: 103.8130 }, // Siem Reap (alt)
  VCBI: { lat: 7.1808, lon: 79.8841 }, // Colombo
  VCRI: { lat: 6.2849, lon: 81.1242 }, // Mattala (Hambantota)
  VRMM: { lat: 4.1918, lon: 73.5290 }, // Malé/Malediven

  // Extra Pacific
  PGUM: { lat: 13.4834, lon: 144.7960 }, // Guam
  PKMJ: { lat: 7.0649, lon: 171.2721 }, // Majuro

  // Extra US destinations
  KABQ: { lat: 35.0402, lon: -106.6092 }, // Albuquerque
  KAUS: { lat: 30.1945, lon: -97.6699 }, // Austin
  KBDL: { lat: 41.9389, lon: -72.6832 }, // Hartford/Springfield
  KBNA: { lat: 36.1246, lon: -86.6782 }, // Nashville
  KBUF: { lat: 42.9405, lon: -78.7322 }, // Buffalo
  KCHS: { lat: 32.8986, lon: -80.0405 }, // Charleston SC
  KIND: { lat: 39.7173, lon: -86.2944 }, // Indianapolis
  KLIT: { lat: 34.7294, lon: -92.2243 }, // Little Rock
  KOKC: { lat: 35.3931, lon: -97.6007 }, // Oklahoma City
  KOMA: { lat: 41.3032, lon: -95.8941 }, // Omaha
  KPBI: { lat: 26.6832, lon: -80.0956 }, // West Palm Beach
  KPVD: { lat: 41.7326, lon: -71.4204 }, // Providence
  KRIC: { lat: 37.5052, lon: -77.3197 }, // Richmond
  KRNO: { lat: 39.4991, lon: -119.7681 }, // Reno
  KSAV: { lat: 32.1276, lon: -81.2021 }, // Savannah
  KSRQ: { lat: 27.3954, lon: -82.5544 }, // Sarasota
  KTUL: { lat: 36.1984, lon: -95.8881 }, // Tulsa

  // Additional Europe
  ENBO: { lat: 67.2692, lon: 14.3653 }, // Bodø
  ENSB: { lat: 78.2461, lon: 15.4656 }, // Longyearbyen/Svalbard
  ESNZ: { lat: 63.1944, lon: 14.5003 }, // Östersund
  ESNU: { lat: 63.7918, lon: 20.2828 }, // Umeå
  EFIV: { lat: 68.6073, lon: 27.4053 }, // Ivalo
  LFKC: { lat: 42.5244, lon: 8.7930 }, // Calvi (Korsika)
  LFTH: { lat: 43.0973, lon: 6.1460 }, // Toulon/Hyères
  LGSK: { lat: 39.1771, lon: 23.5037 }, // Skiathos
  LGSA: { lat: 35.5317, lon: 24.1497 }, // Chania/Kreta
  LIEO: { lat: 40.8987, lon: 9.5177 }, // Olbia/Sardinien
  LGKF: { lat: 38.1201, lon: 20.5005 }, // Kefalonia
  LGSM: { lat: 37.6890, lon: 26.9112 }, // Samos
};

export function getAirportCoords(icao) {
  if (!icao || typeof icao !== 'string') return null;
  const key = icao.trim().toUpperCase();
  return AIRPORT_COORDS[key] || ADDITIONAL_AIRPORT_COORDS[key] || null;
}