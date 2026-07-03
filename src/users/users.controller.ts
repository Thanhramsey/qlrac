import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@Req() req: Request) {
    const user = (req as Request & { user?: JwtPayload }).user;
    return this.usersService.findMe(user?.sub ?? 0);
  }

  @Patch('me')
  updateMe(@Req() req: Request, @Body() updateMyProfileDto: UpdateMyProfileDto) {
    const user = (req as Request & { user?: JwtPayload }).user;
    return this.usersService.updateMe(user?.sub ?? 0, updateMyProfileDto);
  }

  @Patch('me/password')
  updateMyPassword(
    @Req() req: Request,
    @Body() changeMyPasswordDto: ChangeMyPasswordDto,
  ) {
    const user = (req as Request & { user?: JwtPayload }).user;
    return this.usersService.updateMyPassword(user?.sub ?? 0, changeMyPasswordDto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'avatars'),
        filename: (_req, file, cb) => {
          const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `avatar-${suffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  updateMyAvatar(@Req() req: Request, @UploadedFile() avatar?: Express.Multer.File) {
    const user = (req as Request & { user?: JwtPayload }).user;
    const avatarUrl = avatar ? `/uploads/avatars/${avatar.filename}` : null;
    return this.usersService.updateMyAvatar(user?.sub ?? 0, avatarUrl);
  }

  @Get()
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.usersService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('import')
  @Roles('ADMIN', 'ADMIN_LEVEL_2')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  importFromExcel(@UploadedFile() file?: Express.Multer.File) {
    return this.usersService.importFromExcel(file);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
