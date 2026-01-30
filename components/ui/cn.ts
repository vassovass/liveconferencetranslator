/**
 * Utility for conditionally joining classNames (shadcn-style)
 *
 * Inspired by clsx/classnames but minimal implementation
 */

type ClassValue = string | number | boolean | undefined | null | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    }
  }

  return classes.join(' ');
}

/**
 * Create variant classes helper (shadcn cva-style)
 */
export function cva<T extends Record<string, Record<string, string>>>(
  base: string,
  config: {
    variants: T;
    defaultVariants?: { [K in keyof T]?: keyof T[K] };
  }
) {
  return (props?: { [K in keyof T]?: keyof T[K] }) => {
    const classes = [base];

    for (const [variantName, variants] of Object.entries(config.variants)) {
      const variantValue =
        props?.[variantName as keyof T] ??
        config.defaultVariants?.[variantName as keyof T];

      if (variantValue && variants[variantValue as string]) {
        classes.push(variants[variantValue as string]);
      }
    }

    return cn(...classes);
  };
}
