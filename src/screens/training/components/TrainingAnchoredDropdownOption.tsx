import type { ReactNode } from "react";

import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";

type Props = {
  active: boolean;
  onPress: () => void;
  children: ReactNode;
  rightAccessory?: ReactNode;
};

export function TrainingAnchoredDropdownOption(props: Props) {
  return <AnchoredDropdownOption {...props} />;
}
