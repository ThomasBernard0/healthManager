import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuickEntryDto } from './dto/create-quick-entry.dto.js';
import { LogEntryDto } from './dto/log-entry.dto.js';
import { LogMealDto } from './dto/log-meal.dto.js';
import { RestoreLogEntryDto } from './dto/restore-log-entry.dto.js';
import { LogEntriesService } from './log-entries.service.js';

@ApiTags('log-entries')
@Controller('log-entries')
export class LogEntriesController {
  constructor(private readonly entries: LogEntriesService) {}

  /** Logs a saved meal (×quantity portions) with its totals frozen. */
  @Post('meal')
  @ApiCreatedResponse({ type: LogEntryDto })
  @ApiNotFoundResponse()
  logMeal(@Body() dto: LogMealDto): Promise<LogEntryDto> {
    return this.entries.logMeal(dto);
  }

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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.entries.remove(id);
  }
}
