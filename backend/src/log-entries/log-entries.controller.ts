import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuickEntryDto } from './dto/create-quick-entry.dto.js';
import { LogEntryDto } from './dto/log-entry.dto.js';
import { RestoreLogEntryDto } from './dto/restore-log-entry.dto.js';
import { DuplicateLogEntryDto, UpdateLogEntryDto } from './dto/update-log-entry.dto.js';
import { LogEntriesService } from './log-entries.service.js';

@ApiTags('log-entries')
@Controller('log-entries')
export class LogEntriesController {
  constructor(private readonly entries: LogEntriesService) {}

  @Post('quick')
  @ApiCreatedResponse({ type: LogEntryDto })
  createQuick(@Body() dto: CreateQuickEntryDto): Promise<LogEntryDto> {
    return this.entries.createQuick(dto);
  }

  @Post('restore')
  @ApiCreatedResponse({ type: LogEntryDto })
  restore(@Body() dto: RestoreLogEntryDto): Promise<LogEntryDto> {
    return this.entries.restore(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: LogEntryDto })
  @ApiNotFoundResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLogEntryDto,
  ): Promise<LogEntryDto> {
    return this.entries.update(id, dto);
  }

  @Post(':id/duplicate')
  @ApiCreatedResponse({ type: LogEntryDto })
  @ApiNotFoundResponse()
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateLogEntryDto,
  ): Promise<LogEntryDto> {
    return this.entries.duplicate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.entries.remove(id);
  }
}
