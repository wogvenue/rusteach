import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

/** Search input with a leading icon and a clear button. Escape clears. */
const SearchField = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }
>(function SearchField({ value, onChange, placeholder, label, className }, ref) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
        className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-10 text-sm text-fg shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-[color-mix(in_oklab,var(--c-accent)_25%,transparent)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Aramayı temizle"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
});

export default SearchField;
