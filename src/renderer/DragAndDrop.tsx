import { Chip, Tooltip } from '@mui/material';
import { CSSProperties, DragEvent, ReactElement } from 'react';

export function DraggableChip({
  displayName,
  entrantId,
}: {
  displayName: string;
  entrantId: number;
}) {
  const dragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData(
      'text/plain',
      `${event.currentTarget.dataset.entrantId}/${event.currentTarget.dataset.displayName}`,
    );
  };

  return (
    <Chip
      data-display-name={displayName}
      data-entrant-id={entrantId.toString(10)}
      draggable
      onDragStart={dragStart}
      label={displayName}
      variant="outlined"
    />
  );
}

export function DroppableChip({
  active,
  avatar,
  label,
  outlined,
  style,
  onDrop,
}: {
  active: boolean;
  avatar?: ReactElement | undefined;
  label: string;
  outlined: boolean;
  style: CSSProperties;
  onDrop: (displayName: string, entrantId: number) => void;
}) {
  const drop = (event: DragEvent<HTMLDivElement>) => {
    const dataString = event.dataTransfer.getData('text/plain');
    const index = dataString.indexOf('/');
    const newDisplayName = dataString.slice(index + 1);
    const newEntrantId = parseInt(dataString.slice(0, index), 10);
    onDrop(newDisplayName, newEntrantId);
  };

  const dragEnterOver = (event: DragEvent<HTMLDivElement>) => {
    if (active) {
      event.preventDefault();
    }
  };

  const chip = (
    <Chip
      avatar={avatar}
      onDrop={drop}
      onDragEnter={dragEnterOver}
      onDragOver={dragEnterOver}
      label={label}
      style={style}
      variant={outlined ? 'outlined' : 'filled'}
    />
  );

  return active ? (
    <Tooltip arrow title="Drop here!">
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

DroppableChip.defaultProps = {
  avatar: undefined,
};
