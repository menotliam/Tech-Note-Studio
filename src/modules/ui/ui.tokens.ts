export const uiDensity = {
  controlHeight: {
    sm: "h-8",
    md: "h-9",
    lg: "h-10"
  },
  radius: {
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg"
  }
} as const;

export const uiSurfaces = {
  base: "bg-background text-foreground",
  panel: "border border-border bg-panel text-foreground",
  floating: "border border-border bg-panel-strong text-foreground shadow-2xl shadow-black/25",
  muted: "bg-muted text-muted-foreground"
} as const;

export const uiText = {
  panelLabel: "text-xs font-semibold uppercase text-muted-foreground",
  body: "text-sm leading-5",
  caption: "text-xs leading-5 text-muted-foreground"
} as const;

