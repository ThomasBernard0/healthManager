import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ExerciseHistoryEntryDto } from './dto/exercise-history.dto.js';
import { EXERCISE_IMAGE_MAX_BYTES, ExerciseImageUploadDto, type UploadedImage } from './dto/exercise-image.dto.js';
import { ExerciseDto } from './dto/exercise.dto.js';
import { SaveExerciseDto } from './dto/save-exercise.dto.js';
import { ExercisesService } from './exercises.service.js';

@ApiTags('exercises')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  /** Mes exercices, by name. */
  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Accent/case-insensitive, every word anywhere in the name' })
  @ApiOkResponse({ type: [ExerciseDto] })
  list(@Query('q') q?: string): Promise<ExerciseDto[]> {
    return this.exercises.list(q ?? '');
  }

  @Get(':id')
  @ApiOkResponse({ type: ExerciseDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ExerciseDto> {
    return this.exercises.get(id);
  }

  /** Historique / Progression: every finished session with this exercise, most recent first. */
  @Get(':id/history')
  @ApiOkResponse({ type: [ExerciseHistoryEntryDto] })
  @ApiNotFoundResponse()
  history(@Param('id', ParseUUIDPipe) id: string): Promise<ExerciseHistoryEntryDto[]> {
    return this.exercises.history(id);
  }

  @Post()
  @ApiCreatedResponse({ type: ExerciseDto })
  create(@Body() dto: SaveExerciseDto): Promise<ExerciseDto> {
    return this.exercises.create(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: ExerciseDto })
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveExerciseDto): Promise<ExerciseDto> {
    return this.exercises.update(id, dto);
  }

  /** The exercise's picture. The URL changes with the image (?v=imageVersion), so it is cached for good. */
  @Get(':id/image')
  @ApiQuery({ name: 'v', required: false, description: 'imageVersion of the exercise (cache key only)' })
  @ApiOkResponse({ content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } })
  @ApiNotFoundResponse()
  async image(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { mime, data } = await this.exercises.image(id);
    // Only once the image is found: a 404 must not be cached.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(data, { type: mime });
  }

  @Put(':id/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EXERCISE_IMAGE_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ExerciseImageUploadDto })
  @ApiOkResponse({ type: ExerciseDto })
  @ApiBadRequestResponse({ description: 'Not a JPEG, PNG or WebP image' })
  @ApiNotFoundResponse()
  setImage(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: UploadedImage): Promise<ExerciseDto> {
    return this.exercises.setImage(id, file);
  }

  @Delete(':id/image')
  @ApiOkResponse({ type: ExerciseDto })
  @ApiNotFoundResponse()
  removeImage(@Param('id', ParseUUIDPipe) id: string): Promise<ExerciseDto> {
    return this.exercises.removeImage(id);
  }
}
