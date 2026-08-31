import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "./product.entity";
import { ProductService } from "./product.service";
import { ProductController } from "./product.controller";
import { UserModule } from "../users/user.module";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { ProductCardIssuer } from "./entities/product-card-issuer.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      AccountProfile,
      ProductCardIssuer,
      PartyProfile,
    ]),
    UserModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
