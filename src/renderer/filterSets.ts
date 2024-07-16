import { NameWithHighlight, Set, SetWithNames } from '../common/types';

export default function filterSets(
  sets: Set[],
  substr: string,
): SetWithNames[] {
  const setsToShow: SetWithNames[] = [];
  sets.forEach((set) => {
    if (!substr) {
      setsToShow.push({
        set,
        entrant1Names: set.entrant1Participants.map((participant) => ({
          name: participant.displayName,
        })),
        entrant2Names: set.entrant2Participants.map((participant) => ({
          name: participant.displayName,
        })),
      });
    } else {
      const entrant1Names: NameWithHighlight[] = [];
      const entrant2Names: NameWithHighlight[] = [];
      const includeStr = substr.toLowerCase();
      let toShow = false;
      set.entrant1Participants.forEach((participant) => {
        const start = participant.displayName.toLowerCase().indexOf(includeStr);
        if (start < 0) {
          entrant1Names.push({ name: participant.displayName });
        } else {
          toShow = true;
          entrant1Names.push({
            highlight: { start, end: start + includeStr.length },
            name: participant.displayName,
          });
        }
      });
      set.entrant2Participants.forEach((participant) => {
        const start = participant.displayName.toLowerCase().indexOf(includeStr);
        if (start < 0) {
          entrant2Names.push({ name: participant.displayName });
        } else {
          toShow = true;
          entrant2Names.push({
            highlight: { start, end: start + includeStr.length },
            name: participant.displayName,
          });
        }
      });
      if (toShow) {
        setsToShow.push({ set, entrant1Names, entrant2Names });
      }
    }
  });
  return setsToShow;
}
