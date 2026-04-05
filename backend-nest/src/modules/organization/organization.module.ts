import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationsController, RolesController } from './organization.controller';

@Module({
  controllers: [OrganizationsController, RolesController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
