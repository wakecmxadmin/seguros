import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { api } from '@/lib/api';
import { Modal } from '@/lib/enums';
import { SectionTitle, type StepProps } from './types';

/** O legado rotulava sempre "Aeroporto", mesmo em processo marítimo. */
const PORT_LABEL: Record<string, string> = {
  AIR: 'Aeroporto',
  SEA: 'Porto',
  ROAD: 'Ponto de fronteira',
  RAIL: 'Terminal ferroviário',
};

export function StepRoute({ values, set }: StepProps) {
  const portLabel = PORT_LABEL[values.modal] ?? 'Porto';

  const { data: countries } = useQuery({
    queryKey: ['catalog-options', 'countries'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/countries/options');
      return data as Array<{ id: string; label: string }>;
    },
  });

  return (
    <div>
      <SectionTitle>Modal</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(Modal) as Array<keyof typeof Modal>).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => set('modal', key)}
            className={`rounded-md border px-4 py-2 text-[14px] font-medium transition-colors ${
              values.modal === key
                ? 'border-teal bg-teal/8 text-teal'
                : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground'
            }`}
          >
            {Modal[key]}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto_1fr]">
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Origem
          </p>
          <div className="grid gap-4">
            <Field label="País" htmlFor="originCountryId">
              <Select
                id="originCountryId"
                value={values.originCountryId ?? ''}
                onChange={(e) => set('originCountryId', e.target.value || null)}
              >
                <option value="">Selecione…</option>
                {countries?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado" htmlFor="originStateName">
                <Input
                  id="originStateName"
                  value={values.originStateName}
                  onChange={(e) => set('originStateName', e.target.value)}
                />
              </Field>
              <Field label="Cidade" htmlFor="originCityName">
                <Input
                  id="originCityName"
                  value={values.originCityName}
                  onChange={(e) => set('originCityName', e.target.value)}
                />
              </Field>
            </div>

            <PortSelect
              label={portLabel}
              id="originPortId"
              countryId={values.originCountryId}
              modal={values.modal}
              value={values.originPortId}
              onChange={(v) => set('originPortId', v)}
            />

            {values.kind === 'EXPORT' && (
              <Field label="Previsão de saída" htmlFor="departureForecast">
                <Input
                  id="departureForecast"
                  type="date"
                  value={values.departureForecast}
                  onChange={(e) => set('departureForecast', e.target.value)}
                />
              </Field>
            )}
          </div>
        </section>

        <div className="hidden items-center justify-center lg:flex">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-alt">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </span>
        </div>

        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Destino
          </p>
          <div className="grid gap-4">
            <Field label="País" htmlFor="destinationCountryId">
              <Select
                id="destinationCountryId"
                value={values.destinationCountryId ?? ''}
                onChange={(e) => set('destinationCountryId', e.target.value || null)}
              >
                <option value="">Selecione…</option>
                {countries?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado" htmlFor="destinationStateName">
                <Input
                  id="destinationStateName"
                  value={values.destinationStateName}
                  onChange={(e) => set('destinationStateName', e.target.value)}
                />
              </Field>
              <Field label="Cidade" htmlFor="destinationCityName">
                <Input
                  id="destinationCityName"
                  value={values.destinationCityName}
                  onChange={(e) => set('destinationCityName', e.target.value)}
                />
              </Field>
            </div>

            <PortSelect
              label={portLabel}
              id="destinationPortId"
              countryId={values.destinationCountryId}
              modal={values.modal}
              value={values.destinationPortId}
              onChange={(v) => set('destinationPortId', v)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function PortSelect({
  label,
  id,
  countryId,
  modal,
  value,
  onChange,
}: {
  label: string;
  id: string;
  countryId: string | null;
  modal: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { data: ports } = useQuery({
    queryKey: ['catalog-options', 'ports', countryId],
    queryFn: async () => {
      const { data } = await api.get('/catalog/ports/options', {
        params: countryId ? { parentId: countryId } : undefined,
      });
      return data as Array<{ id: string; label: string; code: string | null; modal: string }>;
    },
  });

  // Só faz sentido oferecer pontos do modal escolhido.
  const filtered = ports?.filter((p) => p.modal === modal) ?? [];

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={
        countryId && filtered.length === 0
          ? `Nenhum ${label.toLowerCase()} cadastrado neste país para o modal selecionado.`
          : undefined
      }
    >
      <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Selecione…</option>
        {filtered.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.code ? ` (${p.code})` : ''}
          </option>
        ))}
      </Select>
    </Field>
  );
}
