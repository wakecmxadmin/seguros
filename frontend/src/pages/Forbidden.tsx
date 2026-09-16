import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Forbidden() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-warning/12">
          <ShieldAlert className="h-6 w-6 text-warning" />
        </span>
        <h1 className="text-[20px] font-semibold text-foreground">Acesso não autorizado</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Você não tem permissão para acessar esta área. Se acredita que deveria ter,
          fale com um administrador.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
