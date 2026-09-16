import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, RotateCcw } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loading, LoadError } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface Setting {
  key: string;
  label: string;
  description: string;
  unit: string;
  value: string;
  default: string;
  isDefault: boolean;
}

/**
 * Parâmetros de negócio que ainda dependem de confirmação do cliente
 * (ver docs/12-reuniao-cliente.md). Editáveis para não travar a operação.
 */
export default function Settings() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data as Setting[];
    },
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.put(`/settings/${key}`, { value }),
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      toast.success('Parâmetro atualizado.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const canEdit = can('rate:update');

  return (
    <Page
      title="Parâmetros"
      description="Valores de negócio que o cálculo usa. Alterar aqui vale para os próximos processos."
    >
      <div className="max-w-3xl overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <LoadError message={errorMessage(error)} />
        ) : (
          <ul className="divide-y divide-border">
            {data?.map((setting) => {
              const draft = drafts[setting.key];
              const isDirty = draft !== undefined && draft !== setting.value;

              return (
                <li key={setting.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-foreground">
                        {setting.label}
                        {setting.isDefault && <Badge variant="neutral">padrão</Badge>}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                        {setting.description}
                      </p>
                      <code className="mt-1 block text-[11.5px] text-muted-foreground/60">
                        {setting.key}
                      </code>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Input
                          className="tabular w-28 pr-12 text-right"
                          inputMode="decimal"
                          disabled={!canEdit}
                          value={draft ?? setting.value}
                          onChange={(e) =>
                            setDrafts((c) => ({ ...c, [setting.key]: e.target.value }))
                          }
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                          {setting.unit}
                        </span>
                      </div>

                      {isDirty && (
                        <>
                          <Button
                            size="icon"
                            title="Salvar"
                            loading={save.isPending}
                            onClick={() => save.mutate({ key: setting.key, value: draft })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Descartar"
                            onClick={() =>
                              setDrafts((c) => {
                                const next = { ...c };
                                delete next[setting.key];
                                return next;
                              })
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Page>
  );
}
