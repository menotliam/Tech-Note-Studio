export type NotificationVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "upload"
  | "export"
  | "sync"
  | "lifecycle";

export type NotificationIntent = {
  variant: NotificationVariant;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

