-- Renomeia o parâmetro "Prazo de liberação" para "Prazo para averbação".
-- A regra confirmada pelo cliente: a notificação à seguradora (Cia) precisa
-- ocorrer em até 15 dias da chegada/atracação da carga.
-- Migração só de dados: o schema não muda.

-- Se por algum motivo a chave nova já existir, a antiga é descartada para não
-- violar a PK no UPDATE abaixo.
DELETE FROM "system_settings"
WHERE "key" = 'deadline.release_days'
  AND EXISTS (SELECT 1 FROM "system_settings" WHERE "key" = 'deadline.endorsement_days');

UPDATE "system_settings"
SET "key" = 'deadline.endorsement_days',
    "description" = 'Prazo para averbação'
WHERE "key" = 'deadline.release_days';
