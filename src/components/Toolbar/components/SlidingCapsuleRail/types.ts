import { ReactNode } from "react";

export interface SlidingCapsuleRailProps<T extends string> {
  items: T[];
  activeItem: T;
  onSelectItem: (item: T) => void;
  renderItem: (item: T, inCapsule: boolean) => ReactNode;
  lensScale?: number;
  lensCover?: number;
  lensGlow?: number;
}
