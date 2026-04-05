import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { SuperadminController, PlansController } from './platform.controller';

@Module({
  controllers: [SuperadminController, PlansController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
