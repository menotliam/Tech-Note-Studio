"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, Filter, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RichEmptyState } from "@/modules/states/components/RichEmptyState";
import { securityActivityCategories } from "../security-activity.service";
import type { SecurityActivityCategory } from "../security-activity.types";
import type { SecurityActivityEvent, SecurityActivityLoadResult } from "../security-activity.types";

type SecurityActivityFilter = "all" | string;

export function SecurityActivityPage({ result }: { result: SecurityActivityLoadResult }) {
  const [filter, setFilter] = useState<SecurityActivityFilter>("all");
  const events = result.ok ? result.events : [];
  const filterOptions = useMemo(() => getEventTypeFilterOptions(events), [events]);
  const filteredEvents = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.eventType === filter)),
    [events, filter]
  );

  if (!result.ok) {
    return (
      <div className="grid gap-5">
        <SecurityActivityIntro />
        <ErrorState
          title="Security activity unavailable"
          description={result.message}
          icon={<AlertTriangle size={18} />}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <SecurityActivityIntro />
      <SecurityActivityFilters activeFilter={filter} options={filterOptions} onFilterChange={setFilter} />
      {events.length === 0 ? (
        <RichEmptyState
          kind="security"
          title="No security activity yet"
          description="Protected workflow events such as preference updates, export failures, and upload rejections will appear here."
        />
      ) : filteredEvents.length === 0 ? (
        <RichEmptyState
          kind="security"
          title="No events in this filter"
          description="Try another event type to inspect recent security activity."
          compact
        />
      ) : (
        <SecurityActivityList events={filteredEvents} />
      )}
    </div>
  );
}

export function SecurityActivitySkeleton() {
  return (
    <div className="grid gap-5">
      <section className="rounded-md border border-border bg-panel-strong p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </section>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-24" />
        ))}
      </div>
      <section className="rounded-md border border-border bg-panel-strong">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border-b border-border p-4 last:border-b-0">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </section>
    </div>
  );
}

function SecurityActivityIntro() {
  return (
    <section className="rounded-md border border-border bg-panel-strong p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-background text-primary">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Display-only activity log</h3>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
            Review recent security-relevant events recorded for protected workflows. This page does not manage
            sessions or devices in v0.3.
          </p>
        </div>
      </div>
    </section>
  );
}

function SecurityActivityFilters({
  activeFilter,
  options,
  onFilterChange
}: {
  activeFilter: SecurityActivityFilter;
  options: Array<{ id: SecurityActivityFilter; label: string }>;
  onFilterChange: (filter: SecurityActivityFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-8 items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter size={15} />
        Type
      </span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={cn(
            "h-8 max-w-full truncate rounded-md border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            activeFilter === option.id
              ? "border-primary bg-muted font-medium text-foreground"
              : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
          )}
          onClick={() => onFilterChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SecurityActivityList({ events }: { events: SecurityActivityEvent[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-panel-strong shadow-sm">
      {events.map((event) => (
        <SecurityActivityRow key={event.id} event={event} />
      ))}
    </section>
  );
}

function SecurityActivityRow({ event }: { event: SecurityActivityEvent }) {
  return (
    <article className="border-b border-border p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">{event.title}</h4>
            <SeverityBadge severity={event.severity} />
            <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {formatCategory(event.category)}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{event.description}</p>
        </div>
        <time className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 size={13} />
          {formatDateTime(event.createdAt)}
        </time>
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
        {event.ipAddress ? <MetadataItem label="IP" value={event.ipAddress} /> : null}
        {event.userAgent ? <MetadataItem label="Device" value={summarizeUserAgent(event.userAgent)} /> : null}
        {event.metadata.map((item) => (
          <MetadataItem key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
        ))}
      </dl>
    </article>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background px-2.5 py-2">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="mt-0.5 truncate" title={value}>
        {value}
      </dd>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: SecurityActivityEvent["severity"] }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs",
        severity === "critical"
          ? "border-red-500/40 bg-red-500/10 text-red-200"
          : severity === "warning"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
            : "border-primary/30 bg-primary/10 text-primary"
      )}
    >
      {severity}
    </span>
  );
}

function formatCategory(category: SecurityActivityCategory) {
  return securityActivityCategories.find((item) => item.id === category)?.label ?? "Activity";
}

function getEventTypeFilterOptions(events: SecurityActivityEvent[]) {
  const options = new Map<SecurityActivityFilter, string>([["all", "All"]]);

  events.forEach((event) => {
    if (!options.has(event.eventType)) {
      options.set(event.eventType, event.title);
    }
  });

  return Array.from(options, ([id, label]) => ({ id, label }));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function summarizeUserAgent(userAgent: string) {
  if (userAgent.includes("Firefox")) {
    return "Firefox";
  }

  if (userAgent.includes("Edg/")) {
    return "Microsoft Edge";
  }

  if (userAgent.includes("Chrome")) {
    return "Chrome";
  }

  if (userAgent.includes("Safari")) {
    return "Safari";
  }

  return userAgent.slice(0, 80);
}
