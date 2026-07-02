import { Module } from '@nestjs/common';
import { ServiceCatalogsController } from './service-catalogs.controller';
import { ServiceCatalogsService } from './service-catalogs.service';

@Module({
  controllers: [ServiceCatalogsController],
  providers: [ServiceCatalogsService],
})
export class ServiceCatalogsModule {}
