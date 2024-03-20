import { Checkbox, FormControlLabel } from '@mui/material';
import { ChangeEvent } from 'react';

export default function LabeledCheckbox({
  checked,
  disabled,
  label,
  labelPlacement,
  set,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  set: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            set(event.target.checked);
          }}
        />
      }
      disabled={disabled}
      disableTypography
      label={label}
      labelPlacement={labelPlacement}
      sx={{ typography: 'caption' }}
    />
  );
}

LabeledCheckbox.defaultProps = {
  disabled: false,
  labelPlacement: 'end',
};
