import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentGoalDto, GoalDto } from './dto/goal.dto.js';
import { UpdateGoalDto } from './dto/update-goal.dto.js';
import { GoalsService } from './goals.service.js';

@ApiTags('goals')
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('current')
  @ApiOkResponse({ type: CurrentGoalDto })
  current(): Promise<CurrentGoalDto> {
    return this.goals.current();
  }

  /** Sets the goal from today on (replaces today's version if saved twice). */
  @Put('current')
  @ApiOkResponse({ type: GoalDto })
  update(@Body() dto: UpdateGoalDto): Promise<GoalDto> {
    return this.goals.update(dto);
  }
}
