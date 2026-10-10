import { isIsoDate, normalizeBarcode, TIME_PATTERN } from '@healthmanager/shared';
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

/** A GTIN barcode (EAN-8, UPC-A, EAN-13, GTIN-14) with a valid check digit, digits only. */
export function IsBarcode(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isBarcode',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && normalizeBarcode(value) === value,
        defaultMessage: () => '$property must be a valid EAN/UPC barcode (digits only)',
      },
    },
    options,
  );
}

/** Path params are not run through DTO validation: check barcodes by hand. */
export function parseBarcodeParam(value: string): string {
  const code = normalizeBarcode(value);
  if (code === null) {
    throw new BadRequestException('code must be a valid EAN/UPC barcode');
  }
  return code;
}

/** Path params are not run through DTO validation: check dates by hand. */
export function parseDateParam(value: string): string {
  if (!isIsoDate(value)) {
    throw new BadRequestException('date must be formatted YYYY-MM-DD');
  }
  return value;
}

/** A weight in kg: 0–1000 in 0.5 kg steps (0 = body weight without added load). */
export function IsWeight(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isWeight',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' && value >= 0 && value <= 1000 && Number.isInteger(value * 2),
        defaultMessage: () => '$property must be a weight from 0 to 1000 kg in 0.5 kg steps',
      },
    },
    options,
  );
}
