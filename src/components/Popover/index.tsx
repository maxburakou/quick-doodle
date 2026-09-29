import React, { cloneElement, useState, useRef, useEffect } from "react";
import "./styles.css";
import { PopoverProps } from "./types";

export const Popover: React.FC<PopoverProps> = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const toggleVisibility = () => {
    setIsVisible((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="popover-container">
      {cloneElement(children, {
        ref: triggerRef,
        onClick: toggleVisibility,
        "aria-haspopup": "dialog",
        "aria-expanded": isVisible,
        "aria-controls": "popover-content",
      })}
      {isVisible && (
        <div
          id="popover-content"
          ref={popoverRef}
          className="popover-content"
          role="dialog"
          aria-modal="true"
        >
          {content}
        </div>
      )}
    </div>
  );
};
