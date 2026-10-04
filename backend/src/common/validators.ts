import { isIsoDate, TIME_PATTERN } from '@healthmanager/shared';
import { BadRequestException } from '@nestjs/common';
import { Matches, ValidateBy, ValidationOptions } from 'class-validator';

/** A real calendar date formatted "YYYY-MM-DD". */
export function IsLocalDate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isLocalDate',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isIsoDate(value),
        defaultMessage: () => '$property must be a date formatted YYYY-MM-DD',
      },
    },
    options,
  );
}

/** A time formatted "HH:mm" (00:00–23:59). */
export function IsLocalTime(options?: ValidationOptions): PropertyDecorator {
  return Matches(TIME_PATTERN, {
    message: '$property must be a time formatted HH:mm',
    ...options,
  });
}

/** Path params are not run through DTO validation: check dates by hand. */
export function parseDateParam(value: string): string {
  if (!isIsoDate(value)) {
    throw new BadRequestException('date must be formatted YYYY-MM-DD');
  }
  return value;
}
