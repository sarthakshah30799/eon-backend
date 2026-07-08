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
import { CreateAccountProfileDto } from "./dto/create-account-profile.dto";
import { UpdateAccountProfileDto } from "./dto/update-account-profile.dto";
import { AccountProfileResponseDto } from "./dto/account-profile-response.dto";
import { AccountProfileListQueryDto } from "./dto/account-profile-list-query.dto";
import { AccountProfileListResponseDto } from "./dto/account-profile-list-response.dto";
import { AccountProfileService } from "./account-profile.service";

@ApiTags("account-profiles")
@ApiCookieAuth("sessionId")
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller("account-profiles")
export class AccountProfileController {
  constructor(private readonly accountProfileService: AccountProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get all account profiles (paginated/filtered)" })
  @ApiResponse({
    status: 200,
    description: "Paginated list of account profiles",
    type: AccountProfileListResponseDto,
  })
  async findAll(@Query() query: AccountProfileListQueryDto): Promise<AccountProfileListResponseDto> {
    return this.accountProfileService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get account profile by UUID" })
  @ApiParam({ name: "id", description: "Account profile UUID" })
  @ApiResponse({ status: 200, type: AccountProfileResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  async findById(@Param("id") id: string): Promise<AccountProfileResponseDto> {
    return this.accountProfileService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create an account profile" })
  @ApiResponse({ status: 201, type: AccountProfileResponseDto })
  async create(
    @Body() dto: CreateAccountProfileDto,
    @Session() session: any,
  ): Promise<AccountProfileResponseDto> {
    return this.accountProfileService.create(dto, session.userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an account profile" })
  @ApiParam({ name: "id", description: "Account profile UUID" })
  @ApiResponse({ status: 200, type: AccountProfileResponseDto })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateAccountProfileDto,
    @Session() session: any,
  ): Promise<AccountProfileResponseDto> {
    return this.accountProfileService.update(id, dto, session.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an account profile" })
  @ApiParam({ name: "id", description: "Account profile UUID" })
  @ApiResponse({ status: 200, description: "Successfully deleted" })
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    return this.accountProfileService.delete(id);
  }
}
