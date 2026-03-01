import { RedisLockService } from './redis-lock.service';

describe('RedisLockService', () => {
  let service: RedisLockService;
  let clientMock: any;

  beforeEach(() => {
    service = new RedisLockService();
    clientMock = {
      set: jest.fn(),
      del: jest.fn(),
    };
    // @ts-ignore直接代入测试용 멤버
    service['client'] = clientMock;
  });

  it('acquire returns true when SET returns OK', async () => {
    clientMock.set.mockResolvedValue('OK');
    const res = await service.acquire('key', 1000);
    expect(res).toBe(true);
    expect(clientMock.set).toHaveBeenCalledWith('key', 'locked', 'PX', 1000, 'NX');
  });

  it('acquire returns false when SET returns null', async () => {
    clientMock.set.mockResolvedValue(null);
    const res = await service.acquire('key', 1000);
    expect(res).toBe(false);
  });

  it('release calls del and ignores errors', async () => {
    clientMock.del.mockResolvedValue(1);
    await service.release('key');
    expect(clientMock.del).toHaveBeenCalledWith('key');
  });

  it('runWithLock executes callback when lock acquired', async () => {
    clientMock.set.mockResolvedValue('OK');
    clientMock.del.mockResolvedValue(1);
    const result = await service.runWithLock('x', 100, async () => {
      return 'done';
    });
    expect(result).toBe('done');
    expect(clientMock.del).toHaveBeenCalledWith('x');
  });

  it('runWithLock throws when cannot acquire', async () => {
    clientMock.set.mockResolvedValue(null);
    await expect(
      service.runWithLock('x', 100, async () => 'oops'),
    ).rejects.toThrow('lock_not_acquired');
  });
});