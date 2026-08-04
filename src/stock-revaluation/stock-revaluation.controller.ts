import { Controller, Delete, Get, Post, Query, Res, Session, UploadedFile, UseGuards, UseInterceptors, Body, BadRequestException, Param, ForbiddenException } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { ProcessStockRevaluationDto } from './dto/stock-revaluation.dto';
import { StockRevaluationService } from './stock-revaluation.service';
import { StockRevaluationFrequency } from './stock-revaluation.enums';

@ApiTags('stock-revaluations')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('stock-revaluations')
export class StockRevaluationController {
  constructor(private readonly service: StockRevaluationService) {}

  @Get('template')
  async template(@Res() response: Response) {
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="stock-revaluation-template.xlsx"');
    response.send(await this.service.getTemplate());
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current stock revaluation period' })
  async current(@Query('targets') targets: string, @Query('frequency') frequency: StockRevaluationFrequency, @Session() session: any) {
    const parsedTargets = this.parseTargets(targets);
    const effectiveTargets = session?.isAdmin || session?.isHoStaff
      ? parsedTargets
      : [{ branchId: session?.activeBranchId, counterId: session?.activeCounterId }];
    if (effectiveTargets.some((target) => !target.branchId || !target.counterId)) throw new BadRequestException('Active branch and counter are required');
    if (!Object.values(StockRevaluationFrequency).includes(frequency)) throw new BadRequestException('Stock revaluation frequency is invalid');
    return this.service.current(effectiveTargets, frequency);
  }

  @Post('process')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async process(@UploadedFile() file: { buffer: Buffer } | undefined, @Body('targets') targets: string, @Body('frequency') frequency: string, @Session() session: any) {
    if (!file) throw new BadRequestException('Stock revaluation template file is required');
    const canSelectAllBranches = Boolean(session?.isAdmin || session?.isHoStaff);
    const parsedTargets = this.parseTargets(targets);
    const effectiveTargets = canSelectAllBranches
      ? parsedTargets
      : [{ branchId: session?.activeBranchId, counterId: session?.activeCounterId }];
    if (effectiveTargets.some((target) => !target.branchId || !target.counterId)) throw new BadRequestException('Active branch and counter are required');

    if (!Object.values(StockRevaluationFrequency).includes(frequency as StockRevaluationFrequency)) {
      throw new BadRequestException('Stock revaluation frequency is invalid');
    }
    return this.service.process({ branchIds: [], frequency: frequency as StockRevaluationFrequency, rates: [] }, file, session.userId, effectiveTargets);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Session() session: any) {
    const revaluation = await this.service.findOne(id);
    const isAdminOrHo = Boolean(session?.isAdmin || session?.isHoStaff);
    if (!isAdminOrHo && (revaluation.branchId !== session?.activeBranchId || revaluation.counterId !== session?.activeCounterId)) {
      throw new ForbiddenException('You can delete only the current branch and counter revaluation');
    }
    return this.service.delete(id, session.userId);
  }

  private parseTargets(value: string): Array<{ branchId: string; counterId: string }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException('Branch and counter selection is invalid');
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((target) => !target || typeof target !== 'object' || typeof target.branchId !== 'string' || typeof target.counterId !== 'string')) {
      throw new BadRequestException('At least one branch and counter is required');
    }
    return parsed as Array<{ branchId: string; counterId: string }>;
  }
}
