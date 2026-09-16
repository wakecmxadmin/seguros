import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailChipsInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  invalid?: boolean;
}

/** Campo de destinatários por chips — usado em Para/Cc da composição de mensagem. */
export function EmailChipsInput({ value, onChange, placeholder, invalid }: EmailChipsInputProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const email = draft.trim().replace(/[,;]+$/, '');
    if (!email) return;
    if (EMAIL_RE.test(email) && !value.includes(email)) {
      onChange([...value, email]);
    }
    setDraft('');
  };

  return (
    <div
      className={cn(
        'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-surface px-2.5 py-1.5',
        invalid ? 'border-danger' : 'border-border-strong focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
      )}
    >
      {value.map((email) => (
        <span
          key={email}
          className="inline-flex items-center gap-1 rounded bg-surface-alt px-2 py-0.5 text-[13px] text-foreground"
        >
          {email}
          <button
            type="button"
            onClick={() => onChange(value.filter((e) => e !== email))}
            className="text-muted-foreground hover:text-danger"
            aria-label={`Remover ${email}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',') || v.endsWith(';')) {
            setDraft(v);
            commit();
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            if (draft.trim()) {
              e.preventDefault();
              commit();
            }
          } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="min-w-[120px] flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
    </div>
  );
}
