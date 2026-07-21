import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { VerifyPassengerOtherDocumentDto } from './dto/verify-passenger-other-document.dto';
import { VerifyPassengerPanDto } from './dto/verify-passenger-pan.dto';
import { VerifyPassengerPassportDto } from './dto/verify-passenger-passport.dto';
import { PassengerAmlVerificationResponseDto } from './dto/passenger-aml-verification-response.dto';
import { PassengerOtherIdProofType } from './passenger.entity';
import { PassengerService } from './passenger.service';

@ApiTags('passengers')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard)
@Controller('passengers')
export class PassengerController {
  constructor(private readonly passengerService: PassengerService) {}

  @Get('other-document-types')
  @ApiOperation({ summary: 'Get passenger other document types' })
  @ApiResponse({
    status: 200,
    description: 'Passenger other document types',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
        },
      },
    },
  })
  getOtherDocumentTypes(): Array<{ value: PassengerOtherIdProofType; label: string }> {
    return Object.values(PassengerOtherIdProofType).map(value => ({
      value,
      label: value.replace(/_/g, ' '),
    }));
  }

  @Post('verify-pan')
  @ApiOperation({ summary: 'Verify passenger PAN details' })
  @ApiBody({ type: VerifyPassengerPanDto })
  @ApiResponse({
    status: 200,
    description: 'Passenger PAN verification result',
    type: PassengerAmlVerificationResponseDto,
  })
  verifyPan(
    @Body() dto: VerifyPassengerPanDto,
  ): PassengerAmlVerificationResponseDto {
    return this.passengerService.verifyPan(dto);
  }

  @Post('verify-passport')
  @ApiOperation({ summary: 'Verify passenger passport details' })
  @ApiBody({ type: VerifyPassengerPassportDto })
  @ApiResponse({
    status: 200,
    description: 'Passenger passport verification result',
    type: PassengerAmlVerificationResponseDto,
  })
  verifyPassport(
    @Body() dto: VerifyPassengerPassportDto,
  ): PassengerAmlVerificationResponseDto {
    return this.passengerService.verifyPassport(dto);
  }

  @Post('verify-other-document')
  @ApiOperation({ summary: 'Verify passenger other document details' })
  @ApiBody({ type: VerifyPassengerOtherDocumentDto })
  @ApiResponse({
    status: 200,
    description: 'Passenger other document verification result',
    type: PassengerAmlVerificationResponseDto,
  })
  verifyOtherDocument(
    @Body() dto: VerifyPassengerOtherDocumentDto,
  ): PassengerAmlVerificationResponseDto {
    return this.passengerService.verifyOtherDocument(dto);
  }
}
