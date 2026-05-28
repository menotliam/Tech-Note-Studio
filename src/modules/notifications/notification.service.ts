"use client";

import { createElement } from "react";
import { FileDown, Upload } from "lucide-react";
import { toast } from "sonner";
import type { NotificationIntent } from "./notification.types";

export function notify(intent: NotificationIntent) {
  const options = {
    description: intent.description,
    action: intent.action
      ? {
          label: intent.action.label,
          onClick: intent.action.onClick
        }
      : undefined
  };

  switch (intent.variant) {
    case "success":
      return toast.success(intent.title, options);
    case "error":
      return toast.error(intent.title, options);
    case "warning":
      return toast.warning(intent.title, options);
    case "upload":
      return toast.info(intent.title, {
        ...options,
        icon: createElement(Upload, { size: 16, "aria-hidden": true })
      });
    case "export":
      return toast.info(intent.title, {
        ...options,
        icon: createElement(FileDown, { size: 16, "aria-hidden": true })
      });
    case "sync":
      return toast.warning(intent.title, options);
    case "lifecycle":
    case "info":
      return toast.info(intent.title, options);
  }
}
