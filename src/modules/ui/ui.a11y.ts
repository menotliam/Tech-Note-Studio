export function getControlDescriptionId(id: string, description?: string | null) {
  return description ? `${id}-description` : undefined;
}

export function getControlErrorId(id: string, error?: string | null) {
  return error ? `${id}-error` : undefined;
}

export function getAriaDescribedBy(...ids: Array<string | undefined>) {
  const describedBy = ids.filter(Boolean).join(" ");
  return describedBy.length > 0 ? describedBy : undefined;
}

