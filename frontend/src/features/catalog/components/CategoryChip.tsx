import { cn } from '../../../shared/lib/cn';
import { TINTS, TINT_CLASS, tintStyle } from '../../../shared/lib/tint';
import { SERVICE_CATEGORIES, useLabels } from '../../../shared/constants/labels';
import type { ServiceCategory } from '../../../shared/types';

const ORDER: Record<ServiceCategory, number> = {
  'Support & Maintenance': 0,
  'Cloud Infrastructure': 1,
  Consulting: 2,
  'Software Licenses': 3,
  Security: 4,
  Training: 5,
  'Data & Analytics': 6,
  Development: 7,
};

/** Category label with a stable tint per category (the text is always shown, never colour alone). */
export function CategoryChip({ category }: { category: ServiceCategory }) {
  const labels = useLabels();
  const tint = TINTS[ORDER[category] ?? SERVICE_CATEGORIES.indexOf(category)] ?? TINTS[0]!;
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', TINT_CLASS)} style={tintStyle(tint)}>
      {labels.serviceCategory(category)}
    </span>
  );
}
