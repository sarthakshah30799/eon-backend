import { DayEndEventStatus, DayEndEventType } from "./day-end-process.enums";
import { DayEndProcessWorker } from "./day-end-process.worker";
import { DayEndEvent } from "./entities/day-end-event.entity";

describe("DayEndProcessWorker", () => {
  let worker: DayEndProcessWorker;
  let dayEndEventRepository: {
    create: jest.Mock;
    update: jest.Mock;
  };
  let partyProfileRepository: {
    createQueryBuilder: jest.Mock;
  };
  let database2: {
    transaction: jest.Mock;
  };
  let updateQb: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };

    partyProfileRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(updateQb),
    };

    dayEndEventRepository = {
      create: jest.fn().mockImplementation((row) => row),
      update: jest.fn().mockResolvedValue(undefined),
    };

    database2 = {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: () => dayEndEventRepository,
          query: jest.fn(),
        }),
      ),
    };

    worker = new DayEndProcessWorker(
      database2 as never,
      dayEndEventRepository as never,
      partyProfileRepository as never,
    );
  });

  const buildEvent = (
    overrides: Partial<DayEndEvent> = {},
  ): DayEndEvent =>
    ({
      id: "event-1",
      dayEndExecutionId: "execution-1",
      branchId: "branch-a",
      businessDate: "2026-09-14",
      eventType: DayEndEventType.CLEAR_TEMPORARY_CREDIT,
      payload: {
        dayEndExecutionId: "execution-1",
        branchId: "branch-a",
        businessDate: "2026-09-14",
        actorUserId: "user-1",
      },
      status: DayEndEventStatus.PROCESSING,
      attemptCount: 0,
      availableAt: new Date("2026-09-14T00:00:00.000Z"),
      processedAt: null,
      errorMessage: null,
      lockedAt: null,
      lockedById: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as DayEndEvent;

  it("clears temporary credit for the EOD branch only", async () => {
    await (worker as any).clearTemporaryCredit(buildEvent());

    expect(partyProfileRepository.createQueryBuilder).toHaveBeenCalled();
    expect(updateQb.update).toHaveBeenCalled();
    expect(updateQb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        temporaryCreditLimit: expect.any(Function),
        temporaryCreditDays: expect.any(Function),
        updatedBy: "user-1",
      }),
    );
    expect(updateQb.where).toHaveBeenCalledWith("branch_id = :branchId", {
      branchId: "branch-a",
    });
    expect(updateQb.andWhere).toHaveBeenCalledWith(
      "(temporary_credit_limit IS NOT NULL OR temporary_credit_days IS NOT NULL)",
    );
    expect(updateQb.andWhere).toHaveBeenCalledWith("deleted_at IS NULL");
    expect(updateQb.execute).toHaveBeenCalled();
  });

  it("marks event PROCESSED after successful clear", async () => {
    await (worker as any).processEvent(buildEvent());

    expect(dayEndEventRepository.update).toHaveBeenCalledWith(
      { id: "event-1" },
      expect.objectContaining({
        status: DayEndEventStatus.PROCESSED,
        errorMessage: null,
        lockedAt: null,
        lockedById: null,
      }),
    );
  });

  it("retries as PENDING when attempts remain", async () => {
    updateQb.execute.mockRejectedValue(new Error("db down"));

    await (worker as any).processEvent(buildEvent({ attemptCount: 0 }));

    expect(dayEndEventRepository.update).toHaveBeenCalledWith(
      { id: "event-1" },
      expect.objectContaining({
        status: DayEndEventStatus.PENDING,
        processedAt: null,
        errorMessage: "db down",
      }),
    );
  });

  it("marks FAILED after max attempts", async () => {
    updateQb.execute.mockRejectedValue(new Error("db down"));

    await (worker as any).processEvent(buildEvent({ attemptCount: 9 }));

    expect(dayEndEventRepository.update).toHaveBeenCalledWith(
      { id: "event-1" },
      expect.objectContaining({
        status: DayEndEventStatus.FAILED,
        errorMessage: "db down",
      }),
    );
  });

  it("is idempotent when no temporary credit rows match", async () => {
    updateQb.execute.mockResolvedValue({ affected: 0 });

    await (worker as any).processEvent(buildEvent());

    expect(dayEndEventRepository.update).toHaveBeenCalledWith(
      { id: "event-1" },
      expect.objectContaining({
        status: DayEndEventStatus.PROCESSED,
      }),
    );
  });
});
