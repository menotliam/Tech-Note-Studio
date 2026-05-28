"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { NotificationIntent } from "../notification.types";
import { notify } from "../notification.service";

export type NotificationSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  intent: NotificationIntent;
  children: ReactNode;
};

export function NotificationSubmitButton({
  intent,
  children,
  onClick,
  type = "submit",
  ...props
}: NotificationSubmitButtonProps) {
  return (
    <button
      type={type}
      onClick={(event) => {
        notify(intent);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
