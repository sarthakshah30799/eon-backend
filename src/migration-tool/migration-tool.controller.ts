import {
  Controller,
  ForbiddenException,
  Post,
  Body,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { MigrationToolService } from './migration-tool.service';
import { MigrationRunRequestDto } from './dto/migration-run-request.dto';
import { MigrationVerifyResponseDto } from './dto/migration-verify-response.dto';

@ApiTags('migrations')
@Controller('migrations')
@UseGuards(AuthenticatedGuard)
export class MigrationToolController {
  constructor(private readonly migrationToolService: MigrationToolService) {}

  private ensureAdmin(request: Request) {
    if (!request.session?.isAdmin) {
      throw new ForbiddenException('Only admin users can run migrations');
    }
  }

  @Post('verify')
  @ApiBody({ type: MigrationRunRequestDto })
  async verify(
    @Body() dto: MigrationRunRequestDto,
    @Req() request: Request,
  ): Promise<MigrationVerifyResponseDto> {
    this.ensureAdmin(request);
    return this.migrationToolService.verifyConnection(dto);
  }

  @Post('mock')
  @ApiBody({ type: MigrationRunRequestDto })
  async mock(
    @Body() dto: MigrationRunRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.ensureAdmin(request);
    const result = await this.migrationToolService.run(dto, 'mock', request.session!.userId!);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.setHeader('X-Migration-Mode', 'mock');
    response.setHeader('X-Migration-Summary', JSON.stringify(result.summary));
    return new StreamableFile(result.buffer);
  }

  @Post('run')
  @ApiBody({ type: MigrationRunRequestDto })
  async run(
    @Body() dto: MigrationRunRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.ensureAdmin(request);
    const result = await this.migrationToolService.run(dto, 'real', request.session!.userId!);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.setHeader('X-Migration-Mode', 'real');
    response.setHeader('X-Migration-Summary', JSON.stringify(result.summary));
    return new StreamableFile(result.buffer);
  }

  @Post('apply-current-schema')
  @ApiBody({ type: MigrationRunRequestDto })
  async applyCurrentSchema(
    @Body() dto: MigrationRunRequestDto,
    @Req() request: Request,
  ) {
    this.ensureAdmin(request);
    return this.migrationToolService.runCurrentDatabaseMigrations(dto);
  }
}
