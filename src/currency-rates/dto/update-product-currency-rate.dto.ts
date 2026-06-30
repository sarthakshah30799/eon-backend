import { PartialType } from '@nestjs/swagger';
import { CreateProductCurrencyRateDto } from './create-product-currency-rate.dto';

export class UpdateProductCurrencyRateDto extends PartialType(CreateProductCurrencyRateDto) {}
