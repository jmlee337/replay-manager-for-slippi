import { characterColorIndexLength } from '../common/constants';

const characterIcons = require.context('./characters', true);

export default function getCharacterIcon(
  externalCharacterId: number,
  costumeIndex: number,
) {
  if (!characterColorIndexLength.has(externalCharacterId)) {
    return characterIcons(`./31/0/stock.png`);
  }
  if (costumeIndex >= characterColorIndexLength.get(externalCharacterId)!) {
    return characterIcons(`./${externalCharacterId}/0/stock.png`);
  }
  return characterIcons(`./${externalCharacterId}/${costumeIndex}/stock.png`);
}
