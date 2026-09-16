import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string | null;
  document?: string | null;
}

interface ComboboxProps {
  value: string | null;
  onChange: (id: string | null, option: ComboboxOption | null) => void;
  /** Endpoint que aceita `?search=`. */
  endpoint: string;
  params?: Record<string, string | undefined>;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Rótulo do item já selecionado, para exibir antes de abrir. */
  selectedLabel?: string | null;
  emptyMessage?: string;
}

/**
 * Busca por digitação. Substitui o "código + lupa" do legado, em que era preciso
 * decorar o código numérico do cliente ou abrir um modal de pesquisa.
 */
export function Combobox({
  value,
  onChange,
  endpoint,
  params,
  placeholder = 'Buscar…',
  invalid,
  disabled,
  selectedLabel,
  emptyMessage = 'Nada encontrado.',
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  /** Rótulo do item escolhido nesta sessão — o pai só conhece o id. */
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Valor limpo por fora (ou trocado): descarta o rótulo guardado.
  useEffect(() => {
    if (!value) setPickedLabel(null);
  }, [value]);

  const shownLabel = pickedLabel ?? selectedLabel ?? null;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const { data: options, isFetching } = useQuery({
    queryKey: ['combobox', endpoint, params, debounced],
    queryFn: async () => {
      const { data } = await api.get(endpoint, {
        params: { ...params, ...(debounced ? { search: debounced } : {}) },
      });
      return data as ComboboxOption[];
    },
    enabled: open,
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setSearch('');
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-left text-base shadow-sm transition-colors',
          'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
          invalid ? 'border-danger' : 'border-border-strong',
        )}
      >
        <span className={cn('truncate', !shownLabel && 'text-muted-foreground/70')}>
          {shownLabel || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar"
              onClick={(e) => {
                e.stopPropagation();
                setPickedLabel(null);
                onChange(null, null);
              }}
              className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-surface-alt hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-raised animate-slide-up">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite para buscar…"
              className="h-10 w-full bg-transparent pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground/70"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {options?.length === 0 && (
              <li className="px-3 py-6 text-center text-[13.5px] text-muted-foreground">
                {emptyMessage}
              </li>
            )}
            {options?.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPickedLabel(option.label);
                    onChange(option.id, option);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-alt"
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 text-teal',
                      value === option.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-foreground">
                      {option.label}
                    </span>
                    {option.sublabel && option.sublabel !== option.label && (
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {option.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
