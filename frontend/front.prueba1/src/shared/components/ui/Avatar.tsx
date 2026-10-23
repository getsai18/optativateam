import { cn } from '../../lib/cn';
import { TINTS, TINT_CLASS, tintStyle } from '../../lib/tint';


function initials(name: string): string {
  const words = name
    .replace(/\b(S\.A\.|S\.C\.|A\.C\.|de|C\.V\.|P\.I\.|DE|CV)\b/g, '')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Deterministic initials avatar: the same name always gets the same tint. */
export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
        TINT_CLASS,
        className,
      )}
      style={tintStyle(TINTS[hash % TINTS.length] ?? TINTS[0]!)}
    >
      {initials(name)}
    </span>
  );
}

/** Avatar + name on one line, name truncated with a tooltip. */
export function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block max-w-[36ch] truncate font-medium" title={name}>
          {name}
        </span>
        {sub ? <span className="block max-w-[36ch] truncate text-xs text-muted">{sub}</span> : null}
      </span>
    </span>
  );
}
