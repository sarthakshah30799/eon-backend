import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PassengerAmlVerificationResponseDto } from './dto/passenger-aml-verification-response.dto';
import { LookupPassengerPassportDto } from './dto/lookup-passenger-passport.dto';
import { VerifyPassengerOtherDocumentDto } from './dto/verify-passenger-other-document.dto';
import { VerifyPassengerPanDto } from './dto/verify-passenger-pan.dto';
import { VerifyPassengerPassportDto } from './dto/verify-passenger-passport.dto';
import {
  PassengerEntityType,
  PassengerNationalityType,
  PassengerOtherIdProofType,
  Passenger,
} from './passenger.entity';
import { PassengerPassportLookupResponseDto } from './dto/passenger-passport-lookup-response.dto';

const INVALID_VERIFICATION_TOKEN = /test/i;

const isBlank = (value?: string | null) => !String(value ?? '').trim();

const containsInvalidVerificationToken = (value?: string | null) =>
  INVALID_VERIFICATION_TOKEN.test(String(value ?? '').trim());

@Injectable()
export class PassengerService {
  constructor(
    @InjectRepository(Passenger)
    private readonly passengerRepository: Repository<Passenger>,
  ) {}

  private buildFailure(message: string): PassengerAmlVerificationResponseDto {
    return {
      verified: false,
      message,
    };
  }

  private hasInvalidVerificationToken(values: Array<string | undefined | null>): boolean {
    return values.some(value => containsInvalidVerificationToken(value));
  }

  private buildPassengerLookupPayload(passenger: Passenger): Record<string, unknown> {
    return {
      id: passenger.id,
      entityType: passenger.entityType,
      nationalityType: passenger.nationalityType,
      countryId: passenger.countryId,
      stateId: passenger.stateId,
      locationId: passenger.locationId,
      residentStatusId: passenger.residentStatusId,
      gstStateId: passenger.gstStateId,
      passportNumber: passenger.passportNumber,
      passportIssueAt: passenger.passportIssueAt,
      passportIssueDate: passenger.passportIssueDate,
      passportExpiryDate: passenger.passportExpiryDate,
      arrivalDate: passenger.arrivalDate,
      panNumber: passenger.panNumber,
      panHolderName: passenger.panHolderName,
      panDob: passenger.panDob,
      panHolderRelationType: passenger.panHolderRelationType,
      paidByPanNumber: passenger.paidByPanNumber,
      paidByPanHolderName: passenger.paidByPanHolderName,
      paidByPanDob: passenger.paidByPanDob,
      gstNumber: passenger.gstNumber,
      email: passenger.email,
      contactNo: passenger.contactNo,
      city: passenger.city,
      address1: passenger.address1,
      address2: passenger.address2,
      isPep: passenger.isPep,
      country: passenger.country
        ? {
            id: passenger.country.id,
            code: passenger.country.code,
            name: passenger.country.name,
          }
        : null,
      state: passenger.state
        ? {
            id: passenger.state.id,
            code: passenger.state.code,
            name: passenger.state.name,
          }
        : null,
      gstState: passenger.gstState
        ? {
            id: passenger.gstState.id,
            code: passenger.gstState.code,
            name: passenger.gstState.name,
          }
        : null,
      residentStatus: passenger.residentStatus
        ? {
            id: passenger.residentStatus.id,
            code: passenger.residentStatus.code,
            label: passenger.residentStatus.label,
          }
        : null,
      location: passenger.location
        ? {
            id: passenger.location.id,
            code: passenger.location.code,
            label: passenger.location.label,
          }
        : null,
    };
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
    }

    if (
      this.hasInvalidVerificationToken([
        dto.panNumber,
        dto.panHolderName,
        dto.panDob,
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

  async lookupByPassportNumber(
    dto: LookupPassengerPassportDto,
  ): Promise<PassengerPassportLookupResponseDto> {
    const passportNumber = String(dto.passportNumber ?? '').trim();

    if (!passportNumber) {
      return {
        found: false,
        message: 'Passport number is required',
        passenger: null,
      };
    }

    const passenger = await this.passengerRepository.findOne({
      where: { passportNumber },
      relations: {
        country: true,
        state: true,
        gstState: true,
        residentStatus: true,
        location: true,
      },
      order: {
        updatedAt: 'DESC',
        createdAt: 'DESC',
      },
    });

    if (!passenger) {
      return {
        found: false,
        message: 'No passenger found for this passport number',
        passenger: null,
      };
    }

    return {
      found: true,
      message: 'Passenger found',
      passenger: this.buildPassengerLookupPayload(passenger),
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

    const requiresValidityDate =
      dto.documentType === PassengerOtherIdProofType.DRIVING_LICENSE;

    if (requiresValidityDate && isBlank(dto.validTill)) {
      return this.buildFailure('Valid till is required');
    }

    if (
      this.hasInvalidVerificationToken([
        dto.documentType,
        dto.documentNumber,
        requiresValidityDate ? dto.validTill : undefined,
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
