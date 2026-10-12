import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkoutsService } from '../workouts/workouts.service.js';
import { ProgramDto, ProgramSummaryDto } from './dto/program.dto.js';
import { SaveProgramDto } from './dto/save-program.dto.js';

function validName(dto: SaveProgramDto): string {
  const name = dto.name.trim();
  if (!name) throw new BadRequestException('name must not be blank');
  return name;
}

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workouts: WorkoutsService,
  ) {}

  /** The active program first, then the others in order. */
  async list(): Promise<ProgramSummaryDto[]> {
    const programs = await this.prisma.program.findMany({
      orderBy: [{ active: 'desc' }, { position: 'asc' }],
      include: { _count: { select: { workouts: true } } },
    });
    return programs.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      active: p.active,
      workoutCount: p._count.workouts,
    }));
  }

  async get(id: string): Promise<ProgramDto> {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('Program not found');
    return {
      id: program.id,
      name: program.name,
      position: program.position,
      active: program.active,
      workouts: await this.workouts.summaries(program),
    };
  }

  /** Added at the end, inactive. */
  async create(dto: SaveProgramDto): Promise<ProgramDto> {
    const name = validName(dto);
    const { _max } = await this.prisma.program.aggregate({ _max: { position: true } });
    const program = await this.prisma.program.create({ data: { name, position: (_max.position ?? 0) + 1 } });
    return this.get(program.id);
  }

  async update(id: string, dto: SaveProgramDto): Promise<ProgramDto> {
    const name = validName(dto);
    await this.get(id);
    await this.prisma.program.update({ where: { id }, data: { name } });
    return this.get(id);
  }

  /** The only active one from now on; its rotation restarts at its first séance. */
  async activate(id: string): Promise<ProgramDto> {
    await this.get(id);
    await this.prisma.$transaction([
      this.prisma.program.updateMany({ where: { id: { not: id } }, data: { active: false } }),
      this.prisma.program.update({ where: { id }, data: { active: true, activatedAt: new Date() } }),
    ]);
    return this.get(id);
  }

  /** Not the active one. Its séances go with it (sessions keep their history); the programs after it move up. */
  async remove(id: string): Promise<void> {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('Program not found');
    if (program.active) throw new ConflictException('The active program cannot be deleted');
    await this.prisma.$transaction([
      this.prisma.program.delete({ where: { id } }),
      this.prisma.program.updateMany({
        where: { position: { gt: program.position } },
        data: { position: { decrement: 1 } },
      }),
    ]);
  }
}
