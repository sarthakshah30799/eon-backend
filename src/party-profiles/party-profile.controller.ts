import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Session,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { CreatePartyProfileDto } from "./dto/create-party-profile.dto";
import { ReviewPartyProfileDto } from "./dto/review-party-profile.dto";
import { UpdatePartyProfileDto } from "./dto/update-party-profile.dto";
import { PartyProfileResponseDto } from "./dto/party-profile-response.dto";
import { PartyProfileListQueryDto } from "./dto/party-profile-list-query.dto";
import { PartyProfileListResponseDto } from "./dto/party-profile-list-response.dto";
import { PartyProfileService } from "./party-profile.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";

@ApiTags("party-profiles")
@ApiCookieAuth("sessionId")
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("party-profiles")
export class PartyProfileController {
  constructor(private readonly partyProfileService: PartyProfileService) {}

  @Get("types")
  @ApiOperation({ summary: "Get all party profile types as key-value pairs" })
  @ApiResponse({ status: 200, description: "List of profile types" })
  async getTypes(@Session() session: any): Promise<{ value: string; label: string }[]> {
    return this.partyProfileService.getTypes(session.userId);
  }

  @Get()
  @ApiOperation({ summary: "Get all party profiles (paginated/filtered)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of party profiles",
    type: PartyProfileListResponseDto,
  })
  async findAll(
    @Query() query: PartyProfileListQueryDto,
    @Session() session: any,
  ): Promise<PartyProfileListResponseDto> {
    return this.partyProfileService.findAll(
      query,
      session.userId,
      session.activeBranchId,
    );
  }

  @Get("review-queue")
  @ApiOperation({ summary: "Get party profiles pending review for current HO user" })
  @ApiResponse({ status: 200, description: "Pending review list" })
  async getReviewQueue(@Session() session: any): Promise<PartyProfileResponseDto[]> {
    return this.partyProfileService.getReviewQueue(session.userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get party profile by UUID" })
  @ApiParam({ name: "id", description: "Party profile UUID" })
  @ApiResponse({ status: 200, type: PartyProfileResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  async findById(
    @Param("id") id: string,
    @Session() session: any,
  ): Promise<PartyProfileResponseDto> {
    return this.partyProfileService.findByIdForUser(
      id,
      session.userId,
      session.activeBranchId,
    );
  }

  @Post()
  @ApiOperation({ summary: "Create a party profile" })
  @ApiResponse({ status: 201, type: PartyProfileResponseDto })
  async create(
    @Body() dto: CreatePartyProfileDto,
    @Session() session: any,
  ): Promise<PartyProfileResponseDto> {
    return this.partyProfileService.create(
      dto,
      session.userId,
      session.activeBranchId,
    );
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a party profile" })
  @ApiParam({ name: "id", description: "Party profile UUID" })
  @ApiResponse({ status: 200, type: PartyProfileResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePartyProfileDto,
    @Session() session: any,
  ): Promise<PartyProfileResponseDto> {
    return this.partyProfileService.update(id, dto, session.userId);
  }

  @Post(":id/review")
  @ApiOperation({ summary: "Approve or reject a party profile" })
  @ApiParam({ name: "id", description: "Party profile UUID" })
  @ApiResponse({ status: 200, type: PartyProfileResponseDto })
  async review(
    @Param("id") id: string,
    @Body() dto: ReviewPartyProfileDto,
    @Session() session: any,
  ): Promise<PartyProfileResponseDto> {
    return this.partyProfileService.review(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a party profile" })
  @ApiParam({ name: "id", description: "Party profile UUID" })
  @ApiResponse({ status: 200, description: "Successfully deleted" })
  async delete(
    @Param("id") id: string,
    @Session() session: any,
  ): Promise<{ message: string }> {
    return this.partyProfileService.delete(id, session.userId);
  }

  @Get(":id/commission/template")
  @ApiOperation({ summary: "Download commission template for an agent profile" })
  @ApiParam({ name: "id", description: "Party profile UUID" })
  async getCommissionTemplate(
    @Param("id", ParseUUIDPipe) id: string,
    @Session() session: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.partyProfileService.getCommissionTemplate(
      id,
      session.userId,
      session.activeBranchId,
    );

    res.status(HttpStatus.OK);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="agent-commission-template.csv"`,
    );
    return csv;
  }

  @Post(":id/commission/upload")
  @ApiOperation({ summary: "Upload commission rules for an agent profile" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "id", description: "Party profile UUID" })
  @UseInterceptors(FileInterceptor("file"))
  async uploadCommissionTemplate(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
    @Session() session: any,
  ): Promise<PartyProfileResponseDto> {
    if (!file) {
      throw new BadRequestException("Commission template file is required");
    }

    return this.partyProfileService.uploadCommissionTemplate(
      id,
      file,
      session.userId,
      session.activeBranchId,
    );
  }
}
