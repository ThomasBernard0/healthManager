import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { parseDateParam } from '../common/validators.js';
import { DaySummaryDto } from './dto/day-summary.dto.js';
import { SummaryService } from './summary.service.js';

@ApiTags('summary')
@Controller('summary')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get('days/:date')
  @ApiParam({ name: 'date', example: '2026-10-04' })
  @ApiOkResponse({ type: DaySummaryDto })
  day(@Param('date') date: string): Promise<DaySummaryDto> {
    return this.summary.day(parseDateParam(date));
  }
}
