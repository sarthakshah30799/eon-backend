import { Injectable } from '@nestjs/common';
import { PassengerAmlVerificationResponseDto } from './dto/passenger-aml-verification-response.dto';
import { VerifyPassengerOtherDocumentDto } from './dto/verify-passenger-other-document.dto';
import { VerifyPassengerPanDto } from './dto/verify-passenger-pan.dto';
import { VerifyPassengerPassportDto } from './dto/verify-passenger-passport.dto';
import {
  PassengerEntityType,
  PassengerNationalityType,
} from './passenger.entity';

const INVALID_VERIFICATION_TOKEN = /test/i;

const isBlank = (value?: string | null) => !String(value ?? '').trim();

const containsInvalidVerificationToken = (value?: string | null) =>
  INVALID_VERIFICATION_TOKEN.test(String(value ?? '').trim());

@Injectable()
export class PassengerService {
  private buildFailure(message: string): PassengerAmlVerificationResponseDto {
    return {
      verified: false,
      message,
    };
  }

  private hasInvalidVerificationToken(values: Array<string | undefined | null>): boolean {
    return values.some(value => containsInvalidVerificationToken(value));
  }

  verifyPan(dto: VerifyPassengerPanDto): PassengerAmlVerificationResponseDto {
    const isCorporate = dto.entityType === PassengerEntityType.CORPORATE;
    const isIndianNationality =
      dto.nationalityType === PassengerNationalityType.INDIAN;

    if (isCorporate) {
      if (isBlank(dto.panNumber)) {
        return this.buildFailure('Corporate PAN number is required');
      }
      if (isBlank(dto.panHolderName)) {
        return this.buildFailure('Corporate PAN holder name is required');
      }
      if (isBlank(dto.panDob)) {
        return this.buildFailure('Corporate PAN holder DOB is required');
      }
    } else if (isIndianNationality) {
      if (isBlank(dto.panNumber)) {
        return this.buildFailure('PAN number is required');
      }
      if (isBlank(dto.panHolderName)) {
        return this.buildFailure('PAN holder name is required');
      }
      if (isBlank(dto.panDob)) {
        return this.buildFailure('PAN holder DOB is required');
      }
      if (isBlank(dto.panHolderRelationType)) {
        return this.buildFailure('PAN holder relation is required');
      }
    }

    if (
      this.hasInvalidVerificationToken([
        dto.panNumber,
        dto.panHolderName,
        dto.panDob,
        dto.panHolderRelationType,
      ])
    ) {
      return this.buildFailure('Verification failed. Please review the entered details.');
    }

    return {
      verified: true,
      message: 'PAN details verified successfully',
    };
  }

  verifyPassport(
    dto: VerifyPassengerPassportDto,
  ): PassengerAmlVerificationResponseDto {
    const isIndianNationality = dto.nationalityType === PassengerNationalityType.INDIAN;

    if (isIndianNationality) {
      return this.buildFailure(
        'Passport verification is only required for NRI or foreign passengers',
      );
    }

    if (isBlank(dto.passportNumber)) {
      return this.buildFailure('Passport number is required');
    }
    if (isBlank(dto.passportIssueAt)) {
      return this.buildFailure('Passport issue place is required');
    }
    if (isBlank(dto.passportIssueDate)) {
      return this.buildFailure('Passport issue date is required');
    }
    if (isBlank(dto.passportExpiryDate)) {
      return this.buildFailure('Passport expiry date is required');
    }
    if (isBlank(dto.arrivalDate)) {
      return this.buildFailure('Arrival date is required');
    }

    if (
      dto.passportIssueDate &&
      dto.passportExpiryDate &&
      new Date(dto.passportExpiryDate) < new Date(dto.passportIssueDate)
    ) {
      return this.buildFailure('Passport expiry date must be after issue date');
    }

    if (
      this.hasInvalidVerificationToken([
        dto.passportNumber,
        dto.passportIssueAt,
        dto.passportIssueDate,
        dto.passportExpiryDate,
        dto.arrivalDate,
      ])
    ) {
      return this.buildFailure('Verification failed. Please review the entered details.');
    }

    return {
      verified: true,
      message: 'Passport details verified successfully',
    };
  }

  verifyOtherDocument(
    dto: VerifyPassengerOtherDocumentDto,
  ): PassengerAmlVerificationResponseDto {
    if (isBlank(dto.documentType)) {
      return this.buildFailure('Document type is required');
    }
    if (isBlank(dto.documentNumber)) {
      return this.buildFailure('Document number is required');
    }
    if (isBlank(dto.validTill)) {
      return this.buildFailure('Valid till is required');
    }

    if (
      this.hasInvalidVerificationToken([
        dto.documentType,
        dto.documentNumber,
        dto.validTill,
        dto.issueAt,
        dto.issueDate,
        dto.expiryDate,
      ])
    ) {
      return this.buildFailure('Verification failed. Please review the entered details.');
    }

    return {
      verified: true,
      message: 'Other document verified successfully',
    };
  }
}
