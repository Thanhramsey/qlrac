import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MenusService } from '../menus/menus.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './types/jwt-payload.type';

type JwtExpiresIn =
  | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`
  | number;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly menusService: MenusService,
  ) {}

  async login(loginDto: LoginDto) {
    const key = loginDto.taiKhoanOrSoGiayTo?.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ taiKhoan: key }, { soGiayTo: key }],
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await compare(loginDto.matKhau ?? '', user.matKhauHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }

    const payload: JwtPayload = {
      sub: user.id,
      taiKhoan: user.taiKhoan,
      hoVaTen: user.hoVaTen,
      role: user.roleCode,
    };

    const { accessToken, refreshToken } = await this.generateTokenPair(payload);
    await this.saveRefreshTokenHash(user.id, refreshToken);

    const menusFromRole = await this.menusService.getMenusByRole(user.roleCode);
    const menus = menusFromRole.map((parent) => ({
      key: parent.menuKey,
      label: parent.tenMenu,
      children: (parent.children as Array<{ menuKey: string; tenMenu: string }>).map(
        (child) => ({
          key: child.menuKey,
          label: child.tenMenu,
        }),
      ),
    }));

    return {
      message: 'Đăng nhập thành công',
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn:
        process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '1d',
      user: {
        id: user.id,
        taiKhoan: user.taiKhoan,
        hoVaTen: user.hoVaTen,
        role: user.roleCode,
      },
      menus,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const refreshToken = refreshTokenDto.refreshToken?.trim();
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-jwt-secret',
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        taiKhoan: true,
        hoVaTen: true,
        roleCode: true,
        isActive: true,
        refreshTokenHash: true,
      },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const isRefreshTokenValid = await compare(refreshToken, user.refreshTokenHash);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const newPayload: JwtPayload = {
      sub: user.id,
      taiKhoan: user.taiKhoan,
      hoVaTen: user.hoVaTen,
      role: user.roleCode,
    };

    const tokens = await this.generateTokenPair(newPayload);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      message: 'Làm mới token thành công',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn:
        process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '1d',
    };
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { message: 'Đăng xuất thành công' };
  }

  private async generateTokenPair(payload: JwtPayload) {
    const accessExpiresIn = this.toJwtExpiresIn(
      process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '1d',
    );
    const refreshExpiresIn = this.toJwtExpiresIn(
      process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret:
          process.env.JWT_REFRESH_SECRET ??
          process.env.JWT_SECRET ??
          'dev-jwt-secret',
        expiresIn: refreshExpiresIn,
        jwtid: randomUUID(),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshTokenHash(userId: number, refreshToken: string) {
    const refreshTokenHash = await hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  private toJwtExpiresIn(value: string): JwtExpiresIn {
    const trimmed = value.trim();
    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue) && trimmed !== '') {
      return numericValue;
    }

    return trimmed as JwtExpiresIn;
  }
}
