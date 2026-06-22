import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Session,
} from "@nestjs/common";
import {
  ApiBearerAuth,
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
  async getTypes(): Promise<{ value: string; label: string }[]> {
    return this.partyProfileService.getTypes();
  }

  @Get()
  @ApiOperation({ summary: "Get all party profiles (paginated/filtered)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of party profiles",
    type: PartyProfileListResponseDto,
  })
  async findAll(@Query() query: PartyProfileListQueryDto): Promise<PartyProfileListResponseDto> {
    return this.partyProfileService.findAll(query);
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
  async findById(@Param("id") id: string): Promise<PartyProfileResponseDto> {
    return this.partyProfileService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a party profile" })
  @ApiResponse({ status: 201, type: PartyProfileResponseDto })
  async create(
    @Body() dto: CreatePartyProfileDto,
    @Session() session: any,
  ): Promise<PartyProfileResponseDto> {
    return this.partyProfileService.create(dto, session.userId);
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
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.partyProfileService.delete(id);
  }
}
