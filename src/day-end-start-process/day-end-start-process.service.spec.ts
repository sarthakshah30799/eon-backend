import { BadRequestException } from "@nestjs/common";
import { DayEndEventStatus, DayEndEventType } from "./day-end-process.enums";
import { DayEndStartProcessService } from "./day-end-start-process.service";
import { DayEndExecutionStatus } from "./entities/day-end-execution.entity";

describe("DayEndStartProcessService post-process enqueue", () => {
  const additionalSettingService = {};
  const monthlyLocksService = {};
  const transactionDataLocksService = {};

  let service: DayEndStartProcessService;
  let dayEndExecutionRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let dayEndEventRepository: {
    manager: {
      transaction: jest.Mock;
    };
  };
  let eventRepo: {
    delete: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const branchId = "branch-a";
  const actorUserId = "user-1";
  const businessDate = "2026-09-14";

  beforeEach(() => {
    jest.clearAllMocks();

    eventRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (row) => row),
      create: jest.fn().mockImplementation((row) => row),
    };

    dayEndEventRepository = {
      manager: {
        transaction: jest.fn(async (cb) =>
          cb({
            getRepository: () => eventRepo,
          }),
        ),
      },
    };

    const openExecution = {
      id: "execution-1",
      branchId,
      userId: actorUserId,
      businessDate,
      bodAt: new Date("2026-09-14T01:00:00.000Z"),
      eodAt: null,
      status: DayEndExecutionStatus.BOD_COMPLETED,
      checklistSnapshot: null,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    };

    dayEndExecutionRepository = {
      findOne: jest.fn().mockResolvedValue(openExecution),
      save: jest.fn().mockImplementation(async (row) => ({
        ...row,
        id: openExecution.id,
      })),
    };

    service = new DayEndStartProcessService(
      dayEndExecutionRepository as never,
      dayEndEventRepository as never,
      additionalSettingService as never,
      monthlyLocksService as never,
      transactionDataLocksService as never,
    );

    jest.spyOn(service as any, "getTodayBusinessDate").mockReturnValue(businessDate);
  });

  it("enqueues CLEAR_TEMPORARY_CREDIT after successful day end", async () => {
    const result = await service.completeDayEnd(
      branchId,
      actorUserId,
      { checklist: true },
      actorUserId,
    );

    expect(result.status).toBe(DayEndExecutionStatus.EOD_COMPLETED);
    expect(result.eodAt).toBeTruthy();
    expect(dayEndEventRepository.manager.transaction).toHaveBeenCalled();
    expect(eventRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        dayEndExecutionId: "execution-1",
        eventType: DayEndEventType.CLEAR_TEMPORARY_CREDIT,
      }),
    );
    expect(eventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dayEndExecutionId: "execution-1",
        branchId,
        businessDate,
        eventType: DayEndEventType.CLEAR_TEMPORARY_CREDIT,
        status: DayEndEventStatus.PENDING,
        payload: {
          dayEndExecutionId: "execution-1",
          branchId,
          businessDate,
          actorUserId,
        },
      }),
    );
    expect(eventRepo.save).toHaveBeenCalledTimes(1);
  });

  it("returns EOD success when enqueue fails", async () => {
    dayEndEventRepository.manager.transaction.mockRejectedValue(
      new Error("enqueue failed"),
    );

    const result = await service.completeDayEnd(
      branchId,
      actorUserId,
      {},
      actorUserId,
    );

    expect(result.status).toBe(DayEndExecutionStatus.EOD_COMPLETED);
    expect(result.id).toBe("execution-1");
  });

  it("rejects day end when BOD is missing", async () => {
    dayEndExecutionRepository.findOne.mockResolvedValue(null);

    await expect(
      service.completeDayEnd(branchId, actorUserId, {}, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dayEndEventRepository.manager.transaction).not.toHaveBeenCalled();
  });
});
