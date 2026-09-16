import { ReactNode } from 'react';
import logo from '@/assets/logo.jpeg';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Layout das telas de acesso: painel institucional à esquerda, formulário à direita.
 * No mobile o painel some e sobra apenas o formulário com a marca no topo.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Painel institucional */}
      <aside className="relative hidden w-[44%] max-w-[560px] shrink-0 overflow-hidden bg-navy-deep lg:flex lg:flex-col lg:justify-between">
        {/* Malha de rotas — desenho geométrico discreto, evoca comércio exterior sem virar ilustração */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.13]"
          viewBox="0 0 560 900"
          fill="none"
          aria-hidden
        >
          <defs>
            <pattern id="grade" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M56 0H0v56" stroke="white" strokeWidth="0.5" fill="none" />
            </pattern>
          </defs>
          <rect width="560" height="900" fill="url(#grade)" />
          <path
            d="M60 640C150 620 190 470 300 430S470 330 520 210"
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="7 9"
            fill="none"
          />
          <path
            d="M40 300C140 330 250 300 330 360S460 520 520 560"
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="7 9"
            fill="none"
          />
          {[
            [60, 640],
            [300, 430],
            [520, 210],
            [40, 300],
            [330, 360],
            [520, 560],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="white" />
          ))}
        </svg>

        <div className="relative p-12">
          <Brand light />
        </div>

        <div className="relative p-12">
          <p className="max-w-sm text-[22px] font-semibold leading-snug text-white">
            Seguro de transporte internacional, do orçamento à averbação.
          </p>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/60">
            Cotação, provisória, definitiva e financeiro no mesmo lugar.
          </p>
        </div>

        <div className="relative border-t border-white/10 px-12 py-6">
          <p className="text-[13px] text-white/40">
            Pinho Corretora de Seguros · Comércio Exterior
          </p>
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px] animate-slide-up">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>

          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          )}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function Brand({ light }: { light?: boolean }) {
  return (
    <img
      src={logo}
      alt="Coomex"
      className={cn('h-7 w-auto', light && 'rounded-md bg-white px-2.5 py-1.5')}
    />
  );
}
