import { cn } from "@/lib/utils";

type VariantGroups = Record<string, Record<string, string>>;
type VariantSelection<TVariants extends VariantGroups> = {
  [TKey in keyof TVariants]?: keyof TVariants[TKey] | null;
};

type DefineVariantsOptions<TVariants extends VariantGroups> = {
  base?: string;
  variants?: TVariants;
  defaults?: VariantSelection<TVariants>;
};

export function defineVariants<TVariants extends VariantGroups>(options: DefineVariantsOptions<TVariants>) {
  return (selection?: VariantSelection<TVariants> & { className?: string }) => {
    const variants = options.variants ?? ({} as TVariants);
    const classes = [options.base];

    for (const variantName of Object.keys(variants) as Array<keyof TVariants>) {
      const selectedValue = selection?.[variantName] ?? options.defaults?.[variantName];

      if (selectedValue) {
        classes.push(variants[variantName][selectedValue as string]);
      }
    }

    classes.push(selection?.className);

    return cn(classes);
  };
}

export const focusRingClasses =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const disabledControlClasses = "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

