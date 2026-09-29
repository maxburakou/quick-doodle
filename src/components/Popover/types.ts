import { ButtonHTMLAttributes, ReactElement, ReactNode, RefAttributes } from "react";

export interface PopoverProps {
  children: ReactElement<ButtonHTMLAttributes<HTMLButtonElement> & RefAttributes<HTMLButtonElement>>;
  content: ReactNode;
}
