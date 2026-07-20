import {
  Controller,
  Get,
  Query,
  Session,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { DashboardService } from "./dashboard.service";
import {
  DashboardStatsDto,
  VolumeByCurrencyDto,
  VolumeDataPointDto,
  RecentTransactionDto,
  PendingApprovalDto,
} from "./dto/dashboard.dto";

@ApiTags("dashboard")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private getBranchContext(session: any): { branchId?: string; isAdminOrHo: boolean } {
    const isAdminOrHo = !!(session?.isAdmin || session?.isHo || session?.isHoStaff);
    return {
      branchId: isAdminOrHo ? undefined : session?.activeBranchId,
      isAdminOrHo,
    };
  }

  @Get("stats")
  @ApiOperation({ summary: "Get dashboard stats" })
  async getStats(@Session() session: any): Promise<DashboardStatsDto> {
    const ctx = this.getBranchContext(session);
    return this.dashboardService.getStats(ctx.branchId, ctx.isAdminOrHo);
  }

  @Get("volume-by-currency")
  @ApiOperation({ summary: "Get today vs yesterday volume by currency" })
  async getVolumeByCurrency(@Session() session: any): Promise<VolumeByCurrencyDto[]> {
    const ctx = this.getBranchContext(session);
    return this.dashboardService.getVolumeByCurrency(ctx.branchId, ctx.isAdminOrHo);
  }

  @Get("volume-chart")
  @ApiOperation({ summary: "Get transaction volume chart data" })
  async getVolumeChart(
    @Session() session: any,
    @Query("days") days?: string,
  ): Promise<VolumeDataPointDto[]> {
    const ctx = this.getBranchContext(session);
    return this.dashboardService.getVolumeChart(
      days ? parseInt(days, 10) : 7,
      ctx.branchId,
      ctx.isAdminOrHo,
    );
  }

  @Get("recent-transactions")
  @ApiOperation({ summary: "Get recent transactions" })
  async getRecentTransactions(
    @Session() session: any,
    @Query("limit") limit?: string,
  ): Promise<RecentTransactionDto[]> {
    const ctx = this.getBranchContext(session);
    return this.dashboardService.getRecentTransactions(
      limit ? parseInt(limit, 10) : 10,
      ctx.branchId,
      ctx.isAdminOrHo,
    );
  }

  @Get("pending-approvals")
  @ApiOperation({ summary: "Get pending party profile approvals" })
  async getPendingApprovals(
    @Session() session: any,
    @Query("limit") limit?: string,
  ): Promise<PendingApprovalDto[]> {
    return this.dashboardService.getPendingApprovals(
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
