// Is character external ID tournament legal
export function isValidCharacter(characterId: number) {
  return characterId >= 0 && characterId <= 25;
}

// Character external ID to short name
export const characterNames = new Map([
  [0, 'Falcon'],
  [1, 'DK'],
  [2, 'Fox'],
  [3, 'GW'],
  [4, 'Kirby'],
  [5, 'Bowser'],
  [6, 'Link'],
  [7, 'Luigi'],
  [8, 'Mario'],
  [9, 'Marth'],
  [10, 'Mewtwo'],
  [11, 'Ness'],
  [12, 'Peach'],
  [13, 'Pikachu'],
  [14, 'ICs'],
  [15, 'Puff'],
  [16, 'Samus'],
  [17, 'Yoshi'],
  [18, 'Zelda'],
  [19, 'Sheik'],
  [20, 'Falco'],
  [21, 'YL'],
  [22, 'Doc'],
  [23, 'Roy'],
  [24, 'Pichu'],
  [25, 'Ganon'],
]);

export const characterStartggIds = new Map([
  [0, 2], // Falcon
  [1, 3], // DK
  [2, 6], // Fox
  [3, 16], // GW
  [4, 10], // Kirby
  [5, 1], // Bowser
  [6, 11], // Link
  [7, 12], // Luigi
  [8, 13], // Mario
  [9, 14], // Marth
  [10, 15], // Mewtwo
  [11, 17], // Ness
  [12, 18], // Peach
  [13, 20], // Pikachu
  [14, 8], // ICs
  [15, 9], // Puff
  [16, 22], // Samus
  [17, 24], // Yoshi
  [18, 26], // Zelda
  [19, 23], // Sheik
  [20, 5], // Falco
  [21, 25], // YL
  [22, 4], // Doc
  [23, 21], // Roy
  [24, 19], // Pichu
  [25, 7], // Ganon
]);

export const startggCharacterIds = new Map(
  Array.from(characterStartggIds.entries()).map(([key, value]) => [value, key]),
);

// Stage IDs (not internal stage ID)
export const legalStages = new Set([2, 3, 8, 28, 31, 32]);

// Stage ID (not internal stage ID) to short name
export const stageNames = new Map([
  [2, 'FoD'],
  [3, 'PS'],
  [4, "Peach's Castle"],
  [5, 'Kongo Jungle'],
  [6, 'Brinstar'],
  [7, 'Corneria'],
  [8, 'YS'],
  [9, 'Onett'],
  [10, 'Mute City'],
  [11, 'Rainbow Cruise'],
  [12, 'Jungle Japes'],
  [13, 'Great Bay'],
  [14, 'Hyrule Temple'],
  [15, 'Brinstar Depths'],
  [16, "Yoshi's Island"],
  [17, 'Green Greens'],
  [18, 'Fourside'],
  [19, 'MKI'],
  [20, 'MKII'],
  [22, 'Venom'],
  [23, 'Poké Floats'],
  [24, 'Big Blue'],
  [25, 'Icicle Mountain'],
  [27, 'Flat Zone'],
  [28, 'DL'],
  [29, "Yoshi's Island 64"],
  [30, 'Kongo Jungle 64'],
  [31, 'BF'],
  [32, 'FD'],
]);

export const stageStartggIds = new Map([
  [2, 11], // FoD
  [3, 15], // PS
  [4, 2], // Peach's Castle
  [5, 6], // Kongo Jungle
  [6, 10], // Brinstar
  [7, 13], // Corneria
  [8, 5], // YS
  [9, 17], // Onett
  [10, 16], // Mute City
  [11, 3], // Rainbow Cruise
  [12, 7], // Jungle Japes
  [13, 8], // Great Bay
  [14, 9], // Hyrule Temple
  [15, 24], // Brinstar Depths
  [16, 4], // Yoshi's Island
  [17, 12], // Green Greens
  [18, 28], // Fourside
  [19, 1], // MKI
  [20, 21], // MKII
  [22, 14], // Venom
  [23, 26], // Poké Floats
  [24, 27], // Big Blue
  [25, 18], // Icicle Mountain
  [27, 29], // Flat Zone
  [28, 25], // DL
  [29, 22], // Yoshi's Island 64
  [30, 23], // Kongo Jungle 64
  [31, 19], // BF
  [32, 20], // FD
]);

export const startggStageIds = new Map(
  Array.from(stageStartggIds.entries()).map(([key, value]) => [value, key]),
);
