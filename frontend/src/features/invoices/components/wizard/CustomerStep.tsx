import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Avatar, EmptyState, SearchInput } from '../../../../shared/components/ui';
import { cn } from '../../../../shared/lib/cn';
import type { Customer } from '../../../../shared/types';

interface CustomerStepProps {
  customers: Customer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CustomerStep({ customers, selectedId, onSelect }: CustomerStepProps) {
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => c.active && (!q || c.name.toLowerCase().includes(q) || c.taxId.toLowerCase().includes(q)));
  }, [customers, search]);

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={search} onChange={setSearch} label="Search customers" placeholder="Search by name or tax ID" className="max-w-sm" />
      {rows.length === 0 ? (
        <EmptyState title="No customers match your search" description="Try another name or tax ID, or create the customer first." />
      ) : (
        <fieldset>
          <legend className="sr-only">Customer</legend>
          <ul className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
            {rows.map((c) => {
              const selected = c.id === selectedId;
              return (
                <li key={c.id}>
                  <label
                    className={cn(
                      'relative flex cursor-pointer items-center gap-3 rounded-panel border p-4 transition-all focus-within:ring-2 focus-within:ring-primary-light',
                      selected ? 'border-primary-light bg-primary-soft/60 shadow-card' : 'border-line bg-surface hover:border-primary-light/50 hover:shadow-sm',
                    )}
                  >
                    <input type="radio" name="customer" className="sr-only" checked={selected} onChange={() => onSelect(c.id)} />
                    <Avatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={c.name}>
                        {c.name}
                      </span>
                      <span className="block font-mono text-xs text-muted">{c.taxId}</span>
                      <span className="block truncate text-xs text-muted" title={c.address}>
                        {c.address}
                      </span>
                    </span>
                    {selected ? (
                      <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
