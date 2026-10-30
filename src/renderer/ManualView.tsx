import { Stack } from '@mui/material';
import { DraggableChip } from './DragAndDrop';
import { NameWithHighlight, PlayerOverrides } from '../common/types';

export default function ManualView({
  manualNames,
  searchSubstr,
  selectedChipData,
  setSelectedChipData,
}: {
  manualNames: string[];
  searchSubstr: string;
  selectedChipData: PlayerOverrides;
  setSelectedChipData: (newSelectedChipData: PlayerOverrides) => void;
}) {
  const namesWithHighlights: NameWithHighlight[] = [];
  manualNames.forEach((name) => {
    if (!searchSubstr) {
      namesWithHighlights.push({ name });
      return;
    }

    const start = name.toLowerCase().indexOf(searchSubstr.toLowerCase());
    if (start >= 0) {
      namesWithHighlights.push({
        highlight: { start, end: start + searchSubstr.length },
        name,
      });
    }
  });
  return (
    <Stack bgcolor="white" paddingTop="8px" spacing="8px">
      {namesWithHighlights.map((nameWithHighlight, i) => (
        <DraggableChip
          key={nameWithHighlight.name}
          entrantId={i + 1}
          nameWithHighlight={nameWithHighlight}
          participantId={i + 1}
          prefix=""
          pronouns=""
          selectedChipData={selectedChipData}
          setSelectedChipData={setSelectedChipData}
        />
      ))}
    </Stack>
  );
}
