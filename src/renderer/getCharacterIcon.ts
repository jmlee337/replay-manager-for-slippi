const characterIcons = require.context('./characters', true);

export default function getCharacterIcon(
  externalCharacterId: number,
  costumeIndex: number,
) {
  try {
    return characterIcons(`./${externalCharacterId}/${costumeIndex}/stock.png`);
  } catch (e1: any) {
    try {
      return characterIcons(`./${externalCharacterId}/0/stock.png`);
    } catch (e2: any) {
      return characterIcons(`./31/0/stock.png`);
    }
  }
}
