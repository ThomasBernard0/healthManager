import { Controller, Get, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TonnageDto } from './dto/tonnage.dto.js';
import { TonnageService } from './tonnage.service.js';

@ApiTags('tonnage')
@Controller('tonnage')
export class TonnageController {
  constructor(private readonly tonnage: TonnageService) {}

  /** Accueil: every exercise; Fiche exercice: `exerciseId` only. */
  @Get()
  @ApiQuery({ name: 'exerciseId', required: false, type: String, format: 'uuid' })
  @ApiOkResponse({ type: TonnageDto })
  summary(@Query('exerciseId', new ParseUUIDPipe({ optional: true })) exerciseId?: string): Promise<TonnageDto> {
    return this.tonnage.summary(exerciseId);
  }
}
