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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SaveWorkoutDto } from './dto/save-workout.dto.js';
import { WorkoutDto, WorkoutSummaryDto } from './dto/workout.dto.js';
import { WorkoutsService } from './workouts.service.js';

@ApiTags('workouts')
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  /** Mes séances, in rotation order, with the next one flagged. */
  @Get()
  @ApiOkResponse({ type: [WorkoutSummaryDto] })
  list(): Promise<WorkoutSummaryDto[]> {
    return this.workouts.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: WorkoutDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<WorkoutDto> {
    return this.workouts.get(id);
  }

  /** Nouvelle séance: added at the end of the rotation. */
  @Post()
  @ApiCreatedResponse({ type: WorkoutDto })
  create(@Body() dto: SaveWorkoutDto): Promise<WorkoutDto> {
    return this.workouts.create(dto);
  }

  /** Modifier la séance: name and exercises (full replace, in list order). */
  @Put(':id')
  @ApiOkResponse({ type: WorkoutDto })
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveWorkoutDto): Promise<WorkoutDto> {
    return this.workouts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.workouts.remove(id);
  }
}
