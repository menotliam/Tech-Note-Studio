export function AuthPageShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[1fr_460px]">
      <section className="hidden border-r border-border bg-surface px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold">TechNote Studio</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A technical-first workspace for notes with code, commands, SQL, JSON, exports, and
            offline-friendly editing.
          </p>
        </div>

        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">MVP foundation</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">
            Private notes first, structured editor data always.
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Authentication and row-level access are part of the product foundation, not an
            afterthought.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-sm font-medium text-primary">TechNote Studio</p>
            <h2 className="mt-2 text-3xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
