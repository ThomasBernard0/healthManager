import { ApiProperty } from '@nestjs/swagger';

/** Accepted uploads (the app resizes the picture before sending it). */
export const EXERCISE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const EXERCISE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** What the upload interceptor hands over. */
export interface UploadedImage {
  mimetype: string;
  buffer: Uint8Array;
}

/** Multipart body of PUT /exercises/:id/image. */
export class ExerciseImageUploadDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'JPEG, PNG or WebP, 2 MB at most' })
  file: unknown;
}
