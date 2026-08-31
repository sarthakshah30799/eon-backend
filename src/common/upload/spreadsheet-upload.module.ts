import { Module } from "@nestjs/common";
import { SpreadsheetUploadService } from "./spreadsheet-upload.service";

@Module({
  providers: [SpreadsheetUploadService],
  exports: [SpreadsheetUploadService],
})
export class SpreadsheetUploadModule {}
