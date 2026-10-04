import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';

@ApiTags('access')
@Controller('access')
export class AccessController {
  /** 204 when the access key is right, 401 otherwise (the guard does the work). */
  @Get()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  check(): void {}
}
