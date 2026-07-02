import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        taiKhoan: user.taiKhoan,
        hoVaTen: user.hoVaTen,
        role: user.role,
      },
      menus: [
        {
          key: 'user-management',
          label: 'Quản trị người dùng',
          children: [
            { key: 'users', label: 'Danh sách người dùng' },
            { key: 'roles', label: 'Quản lý quyền' },
            { key: 'user-permissions', label: 'Phân quyền người dùng' },
          ],
        },
      ],
    };
  }
}
