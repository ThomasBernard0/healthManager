import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FinishSessionDto, StartSessionDto } from './dto/save-session.dto.js';
import { CurrentSessionDto, SessionBundleDto, SessionDto } from './dto/session.dto.js';
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

  /** Démarrer a workout: returns the bundle the phone runs the session from, without the network. */
  @Post()
  @ApiCreatedResponse({ type: SessionBundleDto })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({ description: 'No exercise, or not in the active program' })
  @ApiConflictResponse({ description: 'A session is already in progress' })
  start(@Body() dto: StartSessionDto): Promise<SessionBundleDto> {
    return this.sessions.start(dto.workoutId);
  }

  @Get(':id')
  @ApiOkResponse({ type: SessionDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<SessionDto> {
    return this.sessions.get(id);
  }

  /** The bundle of a session in progress, to resume it on a device without its local copy. */
  @Get(':id/bundle')
  @ApiOkResponse({ type: SessionBundleDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Session already finished' })
  bundle(@Param('id', ParseUUIDPipe) id: string): Promise<SessionBundleDto> {
    return this.sessions.bundle(id);
  }

  /** Terminer la séance, with the whole session run on the phone. Already finished: 204 (a retry). */
  @Post(':id/finish')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Not an exercise of the session, set index out of range, bad weight' })
  @ApiNotFoundResponse()
  finish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FinishSessionDto): Promise<void> {
    return this.sessions.finish(id, dto);
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
