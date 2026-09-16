import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Marca uma rota como acessível sem autenticação. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
