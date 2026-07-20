export class DashboardStatsDto {
  todayVolume: string;
  yesterdayVolume: string;
  todayTransactionCount: number;
  yesterdayTransactionCount: number;
  pendingApprovals: number;
  pendingPartyProfileReviews: number;
  activeAlerts: number;
}

export class VolumeByProductDto {
  productId: string;
  productCode: string;
  todayVolume: string;
  yesterdayVolume: string;
  changePercent: string;
}

export class VolumeByCurrencyDto {
  currencyId: string;
  currencyCode: string;
  todayVolume: string;
  yesterdayVolume: string;
  changePercent: string;
  products: VolumeByProductDto[];
}

export class VolumeDataPointDto {
  date: string;
  saleVolume: string;
  purchaseVolume: string;
}

export class RecentTransactionDto {
  id: string;
  number: string;
  partyName: string;
  currencyCode: string;
  productCode: string;
  transactionType: string;
  fcyAmount: string;
  lcyAmount: string;
  status: string;
  createdAt: string;
}

export class PendingApprovalDto {
  id: string;
  code: string;
  name: string;
  type: string;
  createdAt: string;
}
