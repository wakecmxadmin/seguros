import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  /** Alinha à direita — use para valores numéricos. */
  numeric?: boolean;
  width?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Faixa colorida na borda esquerda — usada para status. */
  rowAccent?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowAccent,
  onRowClick,
  footer,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-surface-alt/60">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground',
                  col.numeric && 'text-right',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const accent = rowAccent?.(row);
            return (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-border transition-colors last:border-0',
                  onRowClick && 'cursor-pointer',
                  'hover:bg-surface-alt/50',
                )}
                style={accent ? { boxShadow: `inset 3px 0 0 0 ${accent}` } : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-2.5 text-[13.5px] text-foreground',
                      col.numeric && 'tabular text-right',
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {footer}
      </table>
    </div>
  );
}
