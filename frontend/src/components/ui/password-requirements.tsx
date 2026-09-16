import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PASSWORD_RULES = [
  { id: 'length', label: 'Ao menos 10 caracteres', test: (s: string) => s.length >= 10 },
  { id: 'lowercase', label: 'Uma letra minúscula', test: (s: string) => /[a-z]/.test(s) },
  { id: 'uppercase', label: 'Uma letra maiúscula', test: (s: string) => /[A-Z]/.test(s) },
  { id: 'digit', label: 'Um número', test: (s: string) => /[0-9]/.test(s) },
] as const;

export function isPasswordValid(password: string) {
  return PASSWORD_RULES.every((r) => r.test(password));
}

/**
 * Checklist de requisitos da senha. Mostra o que falta enquanto a pessoa digita,
 * em vez de só acusar erro depois de enviar.
 */
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-1.5 text-[12.5px] transition-colors',
              ok ? 'text-success' : 'text-muted-foreground',
            )}
          >
            {ok ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Circle className="h-3 w-3 shrink-0 opacity-50" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
