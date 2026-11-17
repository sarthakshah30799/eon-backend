import { ApiClient } from './api-client';
import { envConfig, E2EUserCredential } from '../config/env.config';
import { TestLogger } from './test-logger';

export interface UserWorkplaceContext {
  credential: E2EUserCredential;
  userId: string;
  username: string;
  roles: string[];
  isAdmin: boolean;
  isHo: boolean;
  isHoStaff: boolean;
  assignedBranches: Array<{ id: string; name: string; code: string }>;
  assignedCounters: Array<{ id: string; name: string; branchId: string }>;
  activeBranchId?: string;
  activeCounterId?: string;
}

export class WorkplaceManager {
  private static userContexts: Map<string, UserWorkplaceContext> = new Map();

  constructor(private client: ApiClient) {}

  public async discoverUser(credential: E2EUserCredential): Promise<UserWorkplaceContext> {
    const loginRes = await this.client.login(credential.email, credential.password, credential.label);
    if (!loginRes.ok) {
      throw new Error(`Failed to authenticate ${credential.label} (${credential.email})`);
    }

    const meRes = await this.client.get('/auth/me');
    if (!meRes.ok) {
      throw new Error(`Failed to fetch /auth/me for ${credential.label}`);
    }

    const me = meRes.data;
    const ctx: UserWorkplaceContext = {
      credential,
      userId: me.id || me.user?.id,
      username: me.username || me.email,
      roles: (me.roles || []).map((r: any) => (typeof r === 'string' ? r : r.name || r.code)),
      isAdmin: !!(me.isAdmin || me.isSuperAdmin),
      isHo: !!me.isHo,
      isHoStaff: !!me.isHoStaff,
      assignedBranches: me.branches || me.assignedBranches || [],
      assignedCounters: me.counters || me.assignedCounters || [],
      activeBranchId: me.activeBranchId || me.session?.activeBranchId,
      activeCounterId: me.activeCounterId || me.session?.activeCounterId,
    };

    WorkplaceManager.userContexts.set(credential.email, ctx);
    TestLogger.info(`Discovered [${credential.label}]: roles=[${ctx.roles.join(', ')}], isAdmin=${ctx.isAdmin}, isHoStaff=${ctx.isHoStaff}, branches=${ctx.assignedBranches.length}`);
    return ctx;
  }

  public async switchWorkplace(branchId: string, counterId?: string): Promise<boolean> {
    TestLogger.info(`Switching workplace to branch: ${branchId}, counter: ${counterId || 'none'}`);
    const res = await this.client.post('/auth/workplace', { branchId, counterId });
    if (!res.ok) {
      TestLogger.warn(`Workplace switch rejected: ${res.status} ${JSON.stringify(res.data)}`);
      return false;
    }
    return true;
  }

  public async asAdmin(): Promise<UserWorkplaceContext> {
    return this.discoverUser(envConfig.admin);
  }

  public async asHoStaff(): Promise<UserWorkplaceContext> {
    return this.discoverUser(envConfig.hoStaff);
  }

  public async asBranchUser(): Promise<UserWorkplaceContext> {
    for (const cred of envConfig.dynamicUsers) {
      if (!cred) continue;
      try {
        return await this.discoverUser(cred);
      } catch (err: any) {
        TestLogger.warn(
          `Dynamic user login failed for ${cred.label} (${cred.email}): ${err?.message || err}, trying next...`,
        );
      }
    }
    TestLogger.warn('No dynamic branch user authenticated; falling back to admin');
    return this.asAdmin();
  }

  public async asDynamicUser(index: number): Promise<UserWorkplaceContext> {
    const cred = envConfig.dynamicUsers[index];
    if (!cred) {
      throw new Error(`Dynamic user index ${index} not configured`);
    }
    return this.discoverUser(cred);
  }

  public getContext(email: string): UserWorkplaceContext | undefined {
    return WorkplaceManager.userContexts.get(email);
  }

  public getAllContexts(): UserWorkplaceContext[] {
    return Array.from(WorkplaceManager.userContexts.values());
  }
}

