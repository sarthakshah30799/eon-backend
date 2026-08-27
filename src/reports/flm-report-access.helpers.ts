import { In, Repository } from "typeorm";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { UserRole } from "../user-roles/user-role.entity";
import type { Flm1BranchMeta } from "./flm1-daily-cn-summary.helpers";

export const canSeeAllFlmBranches = (session?: SessionContext) =>
  Boolean(session?.isAdmin || session?.isHo || session?.isHoStaff);

export const loadFlmAssignedBranchIds = async (
  userRoleRepository: Repository<UserRole>,
  userId?: string | null,
) => {
  if (!userId) {
    return [];
  }

  const assignments = await userRoleRepository.find({
    where: { user: { id: userId } },
    relations: { branch: true },
  });

  return [
    ...new Set(
      assignments
        .map((assignment) => assignment.branch?.id)
        .filter((branchId): branchId is string => Boolean(branchId)),
    ),
  ];
};

export const resolveFlmAccessibleBranchIds = async (
  userRoleRepository: Repository<UserRole>,
  requestedBranchIds: string[],
  session?: SessionContext,
) => {
  if (canSeeAllFlmBranches(session)) {
    return requestedBranchIds;
  }

  const assignedBranchIds = await loadFlmAssignedBranchIds(
    userRoleRepository,
    session?.userId,
  );
  if (!assignedBranchIds.length) {
    return [];
  }

  if (!requestedBranchIds.length) {
    return assignedBranchIds;
  }

  const assignedBranchIdSet = new Set(assignedBranchIds);
  return requestedBranchIds.filter((branchId) =>
    assignedBranchIdSet.has(branchId),
  );
};

export const loadFlmSelectedBranches = async (
  branchRepository: Repository<Branch>,
  branchIds: string[],
): Promise<Flm1BranchMeta[]> => {
  if (!branchIds.length) {
    return [];
  }

  const branches = await branchRepository.find({
    where: { id: In(branchIds) },
    select: ["id", "code", "name"],
  });
  const labelById = new Map(
    branches.map((branch) => [
      branch.id,
      branch.code && branch.name
        ? `${branch.code} - ${branch.name}`
        : branch.name || branch.code || branch.id,
    ]),
  );

  return branchIds.map((id) => ({
    id,
    label: labelById.get(id) ?? id,
  }));
};
