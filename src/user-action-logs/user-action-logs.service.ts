import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUserActionLogDto } from './dto/query-user-action-log.dto';

export type ActionUserPayload = {
  sub?: number;
  taiKhoan?: string;
  hoVaTen?: string;
  role?: string;
};

export type CreateActionLogInput = {
  user?: ActionUserPayload;
  httpMethod: string;
  endpoint: string;
  statusCode: number;
  action: string;
  moduleKey?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestData?: Prisma.InputJsonObject;
  errorMessage?: string | null;
};

@Injectable()
export class UserActionLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(input: CreateActionLogInput): Promise<void> {
    await this.prisma.userActionLog.create({
      data: {
        userId: input.user?.sub,
        taiKhoan: input.user?.taiKhoan,
        hoVaTen: input.user?.hoVaTen,
        roleCode: input.user?.role,
        httpMethod: input.httpMethod,
        endpoint: input.endpoint,
        action: input.action,
        moduleKey: input.moduleKey ?? null,
        statusCode: input.statusCode,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestData: input.requestData,
        errorMessage: input.errorMessage ?? null,
      },
    });
  }

  async findAll(query: QueryUserActionLogDto) {
    const rawPage = Number(query.page);
    const rawLimit = Number(query.limit);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 100)
      : 20;
    const skip = (page - 1) * limit;

    const keyword = query.keyword?.trim();
    const moduleKey = query.moduleKey?.trim();
    const action = query.action?.trim();

    const where: Prisma.UserActionLogWhereInput = {
      ...(moduleKey ? { moduleKey: { equals: moduleKey, mode: 'insensitive' } } : {}),
      ...(action ? { action: { equals: action, mode: 'insensitive' } } : {}),
      ...(keyword
        ? {
            OR: [
              { taiKhoan: { contains: keyword, mode: 'insensitive' } },
              { hoVaTen: { contains: keyword, mode: 'insensitive' } },
              { moduleKey: { contains: keyword, mode: 'insensitive' } },
              { action: { contains: keyword, mode: 'insensitive' } },
              { endpoint: { contains: keyword, mode: 'insensitive' } },
              { ipAddress: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.userActionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.userActionLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
