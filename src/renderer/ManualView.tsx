import { Stack } from '@mui/material';
import { DraggableChip } from './DragAndDrop';
import { PlayerOverrides } from '../common/types';

export default function ManualView({
  manualNames,
  selectedChipData,
  setSelectedChipData,
}: {
  manualNames: string[];
  selectedChipData: PlayerOverrides;
  setSelectedChipData: (newSelectedChipData: PlayerOverrides) => void;
}) {
  return (
    <Stack paddingTop="8px" spacing="8px">
      {manualNames.map((manualName, i) => (
        <DraggableChip
          key={manualName}
          displayName={manualName}
          entrantId={i + 1}
          prefix=""
          pronouns=""
          selectedChipData={selectedChipData}
          setSelectedChipData={setSelectedChipData}
        />
      ))}
    </Stack>
  );
}
