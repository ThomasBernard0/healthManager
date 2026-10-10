import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExerciseDto } from './dto/exercise.dto.js';
import { SaveExerciseDto } from './dto/save-exercise.dto.js';
import { ExercisesService } from './exercises.service.js';

@ApiTags('exercises')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  /** The exercise bank, by name. */
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

  /** Custom exercise (no image). */
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
}
