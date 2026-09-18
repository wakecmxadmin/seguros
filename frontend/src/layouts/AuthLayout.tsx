import { ReactNode } from 'react';
import logo from '@/assets/logo.jpeg';
import shipPhoto from '@/assets/login-ship.jpg';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Layout das telas de acesso: painel institucional (foto + texto) à esquerda,
 * marca e formulário à direita. No mobile o painel some e sobra só o formulário.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Painel institucional */}
      <aside className="hidden w-1/2 shrink-0 bg-background p-12 lg:flex">
        <div className="relative flex h-full w-full flex-col justify-end overflow-hidden rounded-2xl shadow-sm">
          <img
            src={shipPhoto}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-navy-deep/30 to-transparent" />

          <div className="relative p-10">
            <p className="max-w-sm text-[22px] font-semibold leading-snug text-white">
              Seguro de transporte internacional, do orçamento à averbação.
            </p>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
              Cotação, provisória, definitiva e financeiro no mesmo lugar.
            </p>
          </div>

          <div className="relative border-t border-white/15 px-10 py-6">
            <p className="text-[13px] text-white/50">
              Pinho Corretora de Seguros · Comércio Exterior
            </p>
          </div>
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] animate-slide-up">
          <div className="mb-10">
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

export function Brand({ chip, large }: { chip?: boolean; large?: boolean }) {
  return (
    <img
      src={logo}
      alt="Coomex"
      className={cn(
        large ? 'h-24 w-48' : 'h-14 w-32',
        'object-contain',
        // Fundo do JPEG não é branco puro: é o cinza neutro #F7F7F7 (medido
        // nos cantos vazios da imagem). Usamos o mesmo tom no chip para a
        // borda da imagem não aparecer sobre um fundo branco.
        chip && 'rounded-md bg-[#F7F7F7] px-2.5 py-1.5',
      )}
    />
  );
}
