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

export const characterColorIndexLength = new Map([
  [0, 6], // Falcon
  [1, 5], // DK
  [2, 4], // Fox
  [3, 4], // GW
  [4, 6], // Kirby
  [5, 4], // Bowser
  [6, 5], // Link
  [7, 4], // Luigi
  [8, 5], // Mario
  [9, 5], // Marth
  [10, 4], // Mewtwo
  [11, 4], // Ness
  [12, 5], // Peach
  [13, 4], // Pikachu
  [14, 4], // ICs
  [15, 5], // Puff
  [16, 5], // Samus
  [17, 6], // Yoshi
  [18, 5], // Zelda
  [19, 5], // Sheik
  [20, 4], // Falco
  [21, 5], // YL
  [22, 5], // Doc
  [23, 5], // Roy
  [24, 4], // Pichu
  [25, 5], // Ganon
]);

export const startggCharacterIds = new Map(
  Array.from(characterStartggIds.entries()).map(([key, value]) => [value, key]),
);

// Stage ID (not internal stage ID) to short name
export const stageNames = new Map([
  [2, 'Fountain of Dreams'],
  [3, 'Pokémon Stadium'],
  [4, "Peach's Castle"],
  [5, 'Kongo Jungle'],
  [6, 'Brinstar'],
  [7, 'Corneria'],
  [8, "Yoshi's Story"],
  [9, 'Onett'],
  [10, 'Mute City'],
  [11, 'Rainbow Cruise'],
  [12, 'Jungle Japes'],
  [13, 'Great Bay'],
  [14, 'Temple'],
  [15, 'Brinstar Depths'],
  [16, "Yoshi's Island"],
  [17, 'Green Greens'],
  [18, 'Fourside'],
  [19, 'Mushroom Kingdom'],
  [20, 'Mushroom Kingdom II'],
  [22, 'Venom'],
  [23, 'Poké Floats'],
  [24, 'Big Blue'],
  [25, 'Icicle Mountain'],
  [27, 'Flat Zone'],
  [28, 'Dream Land'],
  [29, "Yoshi's Island N64"],
  [30, 'Kongo Jungle N64'],
  [31, 'Battlefield'],
  [32, 'Final Destination'],
]);

// Stage ID (not internal stage ID) to short name
export const shortStageNames = new Map([
  [2, 'FoD'],
  [3, 'PS'],
  [4, 'PC'],
  [5, 'KJ'],
  [6, 'Brinstar'],
  [7, 'Corneria'],
  [8, 'YS'],
  [9, 'Onett'],
  [10, 'MC'],
  [11, 'RC'],
  [12, 'JJ'],
  [13, 'GB'],
  [14, 'Temple'],
  [15, 'BD'],
  [16, 'YI'],
  [17, 'GG'],
  [18, 'Fourside'],
  [19, 'MK'],
  [20, 'MKII'],
  [22, 'Venom'],
  [23, 'PF'],
  [24, 'BB'],
  [25, 'IM'],
  [27, 'FZ'],
  [28, 'DL'],
  [29, 'YI64'],
  [30, 'KJ64'],
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

// Character external ID to parry.gg / game-metadata character slug.
// Slugs are the filenames in
// game-metadata/games/super-smash-bros-melee/characters/<slug>.json
export const characterParryggSlugs = new Map([
  [0, 'captain-falcon'],
  [1, 'donkey-kong'],
  [2, 'fox'],
  [3, 'mr-game-and-watch'],
  [4, 'kirby'],
  [5, 'bowser'],
  [6, 'link'],
  [7, 'luigi'],
  [8, 'mario'],
  [9, 'marth'],
  [10, 'mewtwo'],
  [11, 'ness'],
  [12, 'peach'],
  [13, 'pikachu'],
  [14, 'ice-climbers'],
  [15, 'jigglypuff'],
  [16, 'samus'],
  [17, 'yoshi'],
  [18, 'zelda'],
  [19, 'sheik'],
  [20, 'falco'],
  [21, 'young-link'],
  [22, 'doctor-mario'],
  [23, 'roy'],
  [24, 'pichu'],
  [25, 'ganondorf'],
]);

// Stage ID to parry.gg / game-metadata stage slug.
// Slugs are the filenames in
// game-metadata/games/super-smash-bros-melee/stages/<slug>.json
// (note accents are stripped: pokmon-stadium, pok-floats). Kongo Jungle N64
// (stage 30) has no game-metadata entry so it is intentionally omitted.
export const stageParryggSlugs = new Map([
  [2, 'fountain-of-dreams'],
  [3, 'pokmon-stadium'],
  [4, 'peachs-castle'],
  [5, 'kongo-jungle'],
  [6, 'brinstar'],
  [7, 'corneria'],
  [8, 'yoshis-story'],
  [9, 'onett'],
  [10, 'mute-city'],
  [11, 'rainbow-cruise'],
  [12, 'jungle-japes'],
  [13, 'great-bay'],
  [14, 'temple'],
  [15, 'brinstar-depths'],
  [16, 'yoshis-island'],
  [17, 'green-greens'],
  [18, 'fourside'],
  [19, 'mushroom-kingdom'],
  [20, 'mushroom-kingdom-ii'],
  [22, 'venom'],
  [23, 'pok-floats'],
  [24, 'big-blue'],
  [25, 'icicle-mountain'],
  [27, 'flat-zone'],
  [28, 'dream-land'],
  [29, 'yoshis-island-64'],
  [31, 'battlefield'],
  [32, 'final-destination'],
]);

// Character external ID to an array indexed by Slippi costumeIndex, whose
// values are the parry.gg game-metadata color name for that costume (null for
// the default costume at index 0). Ordered by external ID.
export const parryggCharacterColors = (
  [
    [null, 'black', 'red', 'white', 'green', 'blue'], // Captain Falcon
    [null, 'black', 'red', 'blue', 'green'], // Donkey Kong
    [null, 'red', 'blue', 'green'], // Fox
    [null, 'red', 'blue', 'green'], // Mr. Game & Watch
    [null, 'yellow', 'blue', 'red', 'green', 'white'], // Kirby
    [null, 'red', 'blue', 'black'], // Bowser
    [null, 'red', 'blue', 'black', 'white'], // Link
    [null, 'white', 'blue', 'red'], // Luigi
    [null, 'yellow', 'black', 'blue', 'green'], // Mario
    [null, 'red', 'green', 'black', 'white'], // Marth
    [null, 'red', 'blue', 'green'], // Mewtwo
    [null, 'gold', 'blue', 'green'], // Ness
    [null, 'gold', 'white', 'blue', 'green'], // Peach
    [null, 'red', 'blue', 'green'], // Pikachu
    [null, 'green', 'yellow', 'red'], // Ice Climbers
    [null, 'red', 'blue', 'green', 'gold'], // Jigglypuff
    [null, 'pink', 'dark', 'green', 'blue'], // Samus
    [null, 'red', 'blue', 'yellow', 'pink', 'cyan'], // Yoshi
    [null, 'red', 'blue', 'green', 'white'], // Zelda
    [null, 'red', 'blue', 'green', 'white'], // Sheik
    [null, 'red', 'blue', 'green'], // Falco
    [null, 'red', 'blue', 'white', 'black'], // Young Link
    [null, 'red', 'blue', 'green', 'black'], // Dr. Mario
    [null, 'red', 'blue', 'green', 'gold'], // Roy
    [null, 'red', 'blue', 'green'], // Pichu
    [null, 'red', 'blue', 'green', 'purple'], // Ganondorf
  ] as (string | null)[][]
).reduce(
  (map, colors, characterId) => map.set(characterId, colors),
  new Map<number, (string | null)[]>(),
);

export const frameMsDivisor = 0.05994;
export const highlightColor = '#ffee58';

export const calledColor = '#f9a825';
export const startedColor = '#0d8225';
