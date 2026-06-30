import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { UserModule } from '../users/user.module';
import { AccountProfile } from '../account-profiles/account-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, AccountProfile]),
    UserModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
