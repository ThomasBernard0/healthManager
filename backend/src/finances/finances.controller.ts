import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FinanceLineDto } from './dto/finance-line.dto.js';
import {
  CreateFinanceLineDto,
  UpdateFinanceLineDto,
} from './dto/save-finance-line.dto.js';
import { FinancesService } from './finances.service.js';

@ApiTags('finances')
@Controller('finance-lines')
export class FinanceLinesController {
  constructor(private readonly finances: FinancesService) {}

  /** The typical month: every line, highest amount first. */
  @Get()
  @ApiOkResponse({ type: [FinanceLineDto] })
  list(): Promise<FinanceLineDto[]> {
    return this.finances.list();
  }

  @Post()
  @ApiCreatedResponse({ type: FinanceLineDto })
  @ApiBadRequestResponse({
    description: 'An expense without a category, or an income with one',
  })
  create(@Body() dto: CreateFinanceLineDto): Promise<FinanceLineDto> {
    return this.finances.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: FinanceLineDto })
  @ApiBadRequestResponse({
    description: 'An expense without a category, or an income with one',
  })
  @ApiNotFoundResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceLineDto,
  ): Promise<FinanceLineDto> {
    return this.finances.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.finances.remove(id);
  }
}
