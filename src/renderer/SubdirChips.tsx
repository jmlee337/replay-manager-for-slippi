import { Chip, Stack } from '@mui/material';
import { Subdir } from '../common/types';

export default function SubdirChips({
  subdirs,
  selectedSubdir,
  onSubdirClick,
}: {
  subdirs: Subdir[];
  selectedSubdir: string;
  onSubdirClick: (subdir: string) => void;
}) {
  return (
    <Stack
      direction="row"
      gap="8px"
      padding="8px 0"
      style={{ overflowX: 'auto' }}
    >
      {subdirs.map((subdir) => {
        const selected = subdir.name === selectedSubdir;
        return (
          <Chip
            key={subdir.name}
            color={selected ? 'primary' : 'default'}
            label={subdir.label || subdir.name}
            style={{ flexShrink: 0 }}
            variant={selected ? 'filled' : 'outlined'}
            onClick={() => onSubdirClick(subdir.name)}
          />
        );
      })}
    </Stack>
  );
}
