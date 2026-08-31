import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Session,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { UserService } from "../users/user.service";
import { PurposeGroupService } from "./purpose-group.service";
import { CreatePurposeGroupDto } from "./dto/create-purpose-group.dto";
import { UpdatePurposeGroupDto } from "./dto/update-purpose-group.dto";
import { PurposeGroupResponseDto } from "./dto/purpose-group-response.dto";
import { PurposeGroupListQueryDto } from "./dto/purpose-group-list-query.dto";
import { PaginatedResponseDto } from "../common/pagination";

@ApiTags("purpose-groups")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("purpose-groups")
export class PurposeGroupController {
  constructor(
    private readonly purposeGroupService: PurposeGroupService,
    private readonly userService: UserService,
  ) {}

  private async assertAdminOrHoStaff(session: {
    userId?: string;
    activeBranchId?: string | null;
    activeCounterId?: string | null;
  }) {
    if (!session.userId) {
      throw new BadRequestException("User session is missing");
    }

    const user = await this.userService.findById(
      session.userId,
      session.userId,
      {
        activeBranchId: session.activeBranchId ?? null,
        activeCounterId: session.activeCounterId ?? null,
      },
    );

    if (!(user.isAdmin || user.isHoStaff)) {
      throw new ForbiddenException(
        "Only admin or HO staff can manage purpose groups",
      );
    }

    return user;
  }

  @Get()
  @ApiOperation({ summary: "Get all purpose groups" })
  @ApiResponse({ status: 200, description: "Paginated list of purpose groups" })
  async findAll(
    @Query() query: PurposeGroupListQueryDto,
  ): Promise<PaginatedResponseDto<PurposeGroupResponseDto>> {
    return this.purposeGroupService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get purpose group by ID" })
  @ApiParam({ name: "id", description: "Purpose group UUID" })
  @ApiResponse({ status: 200, type: PurposeGroupResponseDto })
  async findById(@Param("id") id: string): Promise<PurposeGroupResponseDto> {
    return this.purposeGroupService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a purpose group" })
  async create(
    @Body() dto: CreatePurposeGroupDto,
    @Session()
    session: {
      userId?: string;
      activeBranchId?: string | null;
      activeCounterId?: string | null;
    },
  ): Promise<PurposeGroupResponseDto> {
    const user = await this.assertAdminOrHoStaff(session);
    return this.purposeGroupService.create(dto, user.id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a purpose group" })
  @ApiParam({ name: "id", description: "Purpose group UUID" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePurposeGroupDto,
    @Session()
    session: {
      userId?: string;
      activeBranchId?: string | null;
      activeCounterId?: string | null;
    },
  ): Promise<PurposeGroupResponseDto> {
    const user = await this.assertAdminOrHoStaff(session);
    return this.purposeGroupService.update(id, dto, user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a purpose group" })
  @ApiParam({ name: "id", description: "Purpose group UUID" })
  async delete(
    @Param("id") id: string,
    @Session()
    session: {
      userId?: string;
      activeBranchId?: string | null;
      activeCounterId?: string | null;
    },
  ): Promise<{ message: string }> {
    const user = await this.assertAdminOrHoStaff(session);
    return this.purposeGroupService.delete(id, user.id);
  }
}
