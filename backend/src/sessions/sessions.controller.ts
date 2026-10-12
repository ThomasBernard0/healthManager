import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SaveSetDto, StartSessionDto, UpdateSessionExerciseDto } from './dto/save-session.dto.js';
import { CurrentSessionDto, SessionDto, SessionExerciseDto } from './dto/session.dto.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** The session in progress (survives reloads), or null. */
  @Get('current')
  @ApiOkResponse({ type: CurrentSessionDto })
  current(): Promise<CurrentSessionDto> {
    return this.sessions.current();
  }

  /** Démarrer a workout. */
  @Post()
  @ApiCreatedResponse({ type: SessionDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'No exercise, or not in the active program' })
  @ApiConflictResponse({ description: 'A session is already in progress' })
  start(@Body() dto: StartSessionDto): Promise<SessionDto> {
    return this.sessions.start(dto.workoutId);
  }

  @Get(':id')
  @ApiOkResponse({ type: SessionDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<SessionDto> {
    return this.sessions.get(id);
  }

  /** Exercice en cours: sets with targets, last time, feeling. */
  @Get(':id/exercises/:exerciseId')
  @ApiOkResponse({ type: SessionExerciseDto })
  @ApiNotFoundResponse()
  getExercise(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ): Promise<SessionExerciseDto> {
    return this.sessions.getExercise(id, exerciseId);
  }

  /** Validates (✓) or reopens a set; saved after every set. */
  @Put(':id/exercises/:exerciseId/sets/:index')
  @ApiOkResponse({ type: SessionExerciseDto })
  @ApiBadRequestResponse({ description: 'No value and no target' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Session already finished' })
  saveSet(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: SaveSetDto,
  ): Promise<SessionExerciseDto> {
    return this.sessions.saveSet(id, exerciseId, index, dto);
  }

  /** Ressenti and/or Terminé. */
  @Patch(':id/exercises/:exerciseId')
  @ApiOkResponse({ type: SessionExerciseDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Session already finished' })
  updateExercise(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() dto: UpdateSessionExerciseDto,
  ): Promise<SessionExerciseDto> {
    return this.sessions.updateExercise(id, exerciseId, dto);
  }

  /** Terminer la séance. */
  @Post(':id/finish')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Session already finished' })
  finish(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sessions.finish(id);
  }

  /** Quitter la séance (discards it). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sessions.remove(id);
  }
}
