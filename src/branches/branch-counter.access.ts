import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { BranchCounter } from "./entities/branch-counter.entity";

export async function counterBelongsToBranch(
  branchCounterRepository: Repository<BranchCounter>,
  branchId: string,
  counterId: string,
): Promise<boolean> {
  if (!branchId?.trim() || !counterId?.trim()) {
    return false;
  }

  const link = await branchCounterRepository.findOne({
    where: {
      branchId: branchId.trim(),
      counterId: counterId.trim(),
    },
  });

  return Boolean(link);
}

export async function assertCounterBelongsToBranch(
  branchCounterRepository: Repository<BranchCounter>,
  branchId: string,
  counterId: string,
  message = "Selected counter does not belong to the selected branch",
): Promise<void> {
  const belongs = await counterBelongsToBranch(
    branchCounterRepository,
    branchId,
    counterId,
  );

  if (!belongs) {
    throw new BadRequestException(message);
  }
}

export async function assertCountersExist(
  counterIds: string[],
  findMissing: (ids: string[]) => Promise<string[]>,
): Promise<void> {
  const uniqueIds = [
    ...new Set(counterIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    return;
  }

  const missing = await findMissing(uniqueIds);
  if (missing.length > 0) {
    throw new NotFoundException(`Counter with id ${missing[0]} not found`);
  }
}
