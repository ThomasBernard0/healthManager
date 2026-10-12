import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProgramDto, ProgramSummaryDto } from './dto/program.dto.js';
import { SaveProgramDto } from './dto/save-program.dto.js';
import { ProgramsService } from './programs.service.js';

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  /** Mes programmes: the active one first. */
  @Get()
  @ApiOkResponse({ type: [ProgramSummaryDto] })
  list(): Promise<ProgramSummaryDto[]> {
    return this.programs.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: ProgramDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProgramDto> {
    return this.programs.get(id);
  }

  /** Nouveau programme: inactive, at the end. */
  @Post()
  @ApiCreatedResponse({ type: ProgramDto })
  create(@Body() dto: SaveProgramDto): Promise<ProgramDto> {
    return this.programs.create(dto);
  }

  /** Rename. */
  @Put(':id')
  @ApiOkResponse({ type: ProgramDto })
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveProgramDto): Promise<ProgramDto> {
    return this.programs.update(id, dto);
  }

  /** Activer: the only active program; its rotation restarts at its first séance. */
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ProgramDto })
  @ApiNotFoundResponse()
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<ProgramDto> {
    return this.programs.activate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'The active program cannot be deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.programs.remove(id);
  }
}
