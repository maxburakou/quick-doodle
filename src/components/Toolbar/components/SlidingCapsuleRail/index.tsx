import { CSSProperties } from "react";
import type { SlidingCapsuleRailProps } from "./types";
import "./styles.css";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const SlidingCapsuleRail = <T extends string>({
  items,
  activeItem,
  onSelectItem,
  renderItem,
  lensScale = 1.04,
  lensCover = 1,
  lensGlow = 0.6,
}: SlidingCapsuleRailProps<T>) => {
  const clampedGlow = clamp(lensGlow, 0, 2);
  const activeIndex = Math.max(items.indexOf(activeItem), 0);
  const style = {
    "--active-index": activeIndex,
    "--item-count": items.length,
    "--lens-scale": clamp(lensScale, 1, 1.3),
    "--lens-cover": clamp(lensCover, 0.7, 1),
    "--lens-glow-strength": clampedGlow,
  } as CSSProperties;

  return (
    <menu
      className={`toolbar toolbar-capsule-enabled ${clampedGlow > 0 ? "--lens-glow" : ""}`.trim()}
      style={style}
    >
      <div className="toolbar-active-capsule" aria-hidden />
      <div className="toolbar-lens-overlay" aria-hidden>
        {items.map((item) => (
          <div className="toolbar-item" key={`${item}-lens`}>
            <span className="toolbar-tool-button toolbar-tool-button--lens">
              {renderItem(item, true)}
            </span>
          </div>
        ))}
      </div>
      {items.map((item) => {
        const isActive = item === activeItem;

        return (
          <li className="toolbar-item" key={item}>
            <button
              onClick={() => onSelectItem(item)}
              className="toolbar-tool-button"
              aria-pressed={isActive}
            >
              {renderItem(item, false)}
            </button>
          </li>
        );
      })}
    </menu>
  );
};
