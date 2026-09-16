import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { parseNumber } from '@/lib/format';
import type { CatalogConfig, CatalogField } from './config';

interface CatalogFormDialogProps {
  config: CatalogConfig;
  /** `null` cria um novo registro. */
  record: Record<string, any> | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CatalogFormDialog({ config, record, onClose, onSaved }: CatalogFormDialogProps) {
  const isEditing = !!record;

  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = { active: true };
    for (const field of config.fields) {
      const current = record?.[field.name];
      initial[field.name] =
        current ?? (field.type === 'switch' ? true : field.type === 'rate' ? '0,00000' : '');
      // Taxas voltam do backend como string decimal — exibimos no padrão pt-BR.
      if (field.type === 'rate' && current !== undefined && current !== null) {
        initial[field.name] = Number(current).toFixed(5).replace('.', ',');
      }
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {};

      for (const field of config.fields) {
        const raw = values[field.name];

        if (field.type === 'switch') {
          payload[field.name] = !!raw;
        } else if (field.type === 'rate') {
          payload[field.name] = parseNumber(String(raw ?? '0'));
        } else if (field.type === 'number') {
          payload[field.name] = raw === '' || raw === null ? null : Number(raw);
        } else {
          payload[field.name] = raw === '' ? null : raw;
        }
      }

      return isEditing
        ? api.patch(`/catalog/${config.key}/${record!.id}`, payload)
        : api.post(`/catalog/${config.key}`, payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? `${config.label} atualizado.` : `${config.label} cadastrado.`);
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const found: Record<string, string> = {};
    for (const field of config.fields) {
      if (field.required && !String(values[field.name] ?? '').trim()) {
        found[field.name] = `Informe ${field.label.toLowerCase()}.`;
      }
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader
          title={isEditing ? `Editar ${config.label.toLowerCase()}` : `Novo(a) ${config.label.toLowerCase()}`}
          description={config.description}
        />

        <form onSubmit={submit} noValidate className="contents">
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {config.fields.map((field) => (
                <FieldControl
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  error={errors[field.name]}
                  parentValue={field.parentField ? values[field.parentField] : undefined}
                  onChange={(value) => setValues((v) => ({ ...v, [field.name]: value }))}
                />
              ))}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldControl({
  field,
  value,
  error,
  parentValue,
  onChange,
}: {
  field: CatalogField;
  value: any;
  error?: string;
  parentValue?: string;
  onChange: (value: any) => void;
}) {
  const { data: options } = useQuery({
    queryKey: ['catalog-options', field.optionsFrom, parentValue],
    queryFn: async () => {
      const { data } = await api.get(`/catalog/${field.optionsFrom}/options`, {
        params: parentValue ? { parentId: parentValue } : undefined,
      });
      return data as Array<{ id: string; label: string }>;
    },
    enabled: !!field.optionsFrom,
  });

  const className = field.span === 2 ? 'sm:col-span-2' : undefined;

  if (field.type === 'switch') {
    return (
      <div className={`flex items-center gap-2.5 pt-6 ${className ?? ''}`}>
        <Switch checked={!!value} onCheckedChange={onChange} id={field.name} />
        <label htmlFor={field.name} className="cursor-pointer text-[14px] text-foreground">
          {field.label}
        </label>
      </div>
    );
  }

  return (
    <Field
      label={field.label}
      htmlFor={field.name}
      error={error}
      hint={field.hint}
      required={field.required}
      className={className}
    >
      {field.type === 'select' ? (
        <Select
          id={field.name}
          value={value ?? ''}
          invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          {field.options
            ? field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : options?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
        </Select>
      ) : (
        <Input
          id={field.name}
          value={value ?? ''}
          invalid={!!error}
          inputMode={field.type === 'number' || field.type === 'rate' ? 'decimal' : undefined}
          placeholder={field.placeholder}
          className={field.type === 'rate' || field.type === 'number' ? 'tabular text-right' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
