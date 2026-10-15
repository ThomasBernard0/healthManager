import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FinanceLine } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FinanceLineDto } from './dto/finance-line.dto.js';
import {
  CreateFinanceLineDto,
  UpdateFinanceLineDto,
} from './dto/save-finance-line.dto.js';

export function toFinanceLineDto(line: FinanceLine): FinanceLineDto {
  return {
    id: line.id,
    kind: line.kind,
    name: line.name,
    amountCents: line.amountCents,
    category: line.category,
  };
}

/** An expense has a category, an income has none. */
export function checkCategory(
  kind: FinanceLine['kind'],
  category: FinanceLine['category'] | undefined,
): void {
  if (kind === 'expense' && !category)
    throw new BadRequestException('An expense needs a category');
  if (kind === 'income' && category)
    throw new BadRequestException('An income has no category');
}

@Injectable()
export class FinancesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every line, highest amount first. */
  async list(): Promise<FinanceLineDto[]> {
    const lines = await this.prisma.financeLine.findMany({
      orderBy: [{ amountCents: 'desc' }, { createdAt: 'asc' }],
    });
    return lines.map(toFinanceLineDto);
  }

  async create(dto: CreateFinanceLineDto): Promise<FinanceLineDto> {
    checkCategory(dto.kind, dto.category);
    const line = await this.prisma.financeLine.create({
      data: {
        kind: dto.kind,
        name: dto.name,
        amountCents: dto.amountCents,
        category: dto.category ?? null,
      },
    });
    return toFinanceLineDto(line);
  }

  /** Overwrites the line; switching it to an income drops its category. */
  async update(id: string, dto: UpdateFinanceLineDto): Promise<FinanceLineDto> {
    const existing = await this.prisma.financeLine.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Finance line not found');
    const kind = dto.kind ?? existing.kind;
    const category =
      dto.category !== undefined
        ? dto.category
        : kind === 'income'
          ? null
          : existing.category;
    checkCategory(kind, category);
    const line = await this.prisma.financeLine.update({
      where: { id },
      data: { kind, name: dto.name, amountCents: dto.amountCents, category },
    });
    return toFinanceLineDto(line);
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.financeLine.deleteMany({
      where: { id },
    });
    if (count === 0) throw new NotFoundException('Finance line not found');
  }
}
