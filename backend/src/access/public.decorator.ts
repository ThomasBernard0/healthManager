import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Skips the access-key check (health check only). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
