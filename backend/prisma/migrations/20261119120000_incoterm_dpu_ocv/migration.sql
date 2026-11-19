-- Incoterms do catálogo do SIGRA (global.sx_incoterms) que faltavam no enum.
ALTER TYPE "Incoterm" ADD VALUE IF NOT EXISTS 'DPU';
ALTER TYPE "Incoterm" ADD VALUE IF NOT EXISTS 'OCV';
