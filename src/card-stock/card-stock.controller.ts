import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  Session,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { AuthenticatedGuard } from "../auth/guards/authenticated.guard";
import { CreateCardStockReceiptDto } from "./dto/card-stock-receipt.dto";
import { RecordCardStockPrintDto } from "./dto/card-stock-print.dto";
import { CardStockService } from "./card-stock.service";
import { CardStockReceiptListQueryDto } from "./dto/card-stock-receipt-list-query.dto";
import { AuthenticatedSession } from "../auth/types/session-context";

@ApiTags("card-stock")
@ApiCookieAuth("sessionId")
@UseGuards(AuthenticatedGuard)
@Controller("card-stock/receipts")
export class CardStockController {
  constructor(private readonly cardStockService: CardStockService) {}

  @Get()
  @ApiOperation({ summary: "List CARD stock receipts" })
  findAll(
    @Session() session: any,
    @Query() query: CardStockReceiptListQueryDto,
  ) {
    const branchId =
      session?.isAdmin || session?.isHo || session?.isHoStaff
        ? undefined
        : session?.activeBranchId;
    return this.cardStockService.findAll(query, branchId);
  }

  @Get("cards/template")
  @ApiOperation({ summary: "Download CARD stock upload template" })
  async downloadTemplate(@Res() response: Response) {
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="card-stock-upload-template.xlsx"',
    );
    response.send(this.cardStockService.getUploadTemplate());
  }

  @Post("cards/preview")
  @ApiOperation({
    summary: "Preview CARD stock CSV or Excel rows for one receipt item",
  })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  previewUpload(
    @UploadedFile()
    file: { buffer?: Buffer; originalname?: string } | undefined,
    @Body("issuerPartyProfileId") issuerPartyProfileId: string,
  ) {
    if (!file) throw new BadRequestException("CARD stock file is required");
    return this.cardStockService.previewUpload(file, issuerPartyProfileId);
  }

  @Get("cards/available")
  @ApiOperation({ summary: "List available CARDs for a normal sale" })
  findAvailableCards(
    @Query("branchId") branchId: string,
    @Query("currencyId") currencyId: string,
    @Query("productId") productId: string,
    @Query("issuerPartyProfileId") issuerPartyProfileId: string,
    @Session() session: any,
  ) {
    const effectiveBranchId =
      session?.isAdmin || session?.isHo || session?.isHoStaff
        ? branchId
        : session?.activeBranchId;
    return this.cardStockService.findAvailableCards(
      effectiveBranchId,
      currencyId,
      productId,
      issuerPartyProfileId,
    );
  }

  @Get("cards/reload")
  @ApiOperation({
    summary: "List CARDs previously sold to a passenger for reload",
  })
  findReloadCards(
    @Query("branchId") branchId: string,
    @Query("passengerId") passengerId: string,
    @Query("currencyId") currencyId: string,
    @Query("productId") productId: string,
    @Query("issuerPartyProfileId") issuerPartyProfileId: string,
    @Session() session: any,
  ) {
    const effectiveBranchId =
      session?.isAdmin || session?.isHo || session?.isHoStaff
        ? branchId
        : session?.activeBranchId;
    return this.cardStockService.findReloadCards(
      effectiveBranchId,
      passengerId,
      currencyId,
      productId,
      issuerPartyProfileId,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get CARD stock receipt" })
  findById(@Param("id") id: string, @Session() session: AuthenticatedSession) {
    return this.cardStockService.findById(id, session);
  }

  @Post(":id/print")
  @ApiOperation({
    summary: "Record CARD stock receipt print (Original then Duplicate)",
  })
  recordPrint(
    @Param("id") id: string,
    @Body() dto: RecordCardStockPrintDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.cardStockService.recordPrint(id, dto, session);
  }

  @Post()
  @ApiOperation({ summary: "Create CARD stock receipt" })
  create(
    @Body() dto: CreateCardStockReceiptDto,
    @Session() session: AuthenticatedSession,
  ) {
    return this.cardStockService.create(dto, session);
  }
}
