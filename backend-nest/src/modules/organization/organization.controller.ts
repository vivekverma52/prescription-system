import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgAdminGuard } from '../../common/guards/org-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppError } from '../../common/errors/app.error';

// ── Organizations Controller ──────────────────────────────────────────────────

@Controller('api/organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('me')
  async getOrg(@CurrentUser() user: any, @Res() res: Response) {
    if (!user.orgId) throw AppError.notFound('Organization');
    const org = await this.organizationService.getOrg(user.orgId);
    return res.status(200).json({ success: true, data: org });
  }

  @Put('me')
  @UseGuards(OrgAdminGuard)
  async updateOrg(@CurrentUser() user: any, @Body() body: any, @Res() res: Response) {
    const org = await this.organizationService.updateOrg(user.userId, user.orgId, body);
    return res.status(200).json({ success: true, message: 'Organization updated', data: org });
  }

  @Get('me/team')
  async getTeam(@CurrentUser() user: any, @Res() res: Response) {
    const team = await this.organizationService.getTeam(user.orgId);
    return res.status(200).json({ success: true, data: team });
  }

  @Post('me/members')
  @UseGuards(OrgAdminGuard)
  async createMember(@CurrentUser() user: any, @Body() body: any, @Res() res: Response) {
    const member = await this.organizationService.createMember(user.userId, user.orgId, body);
    return res.status(201).json({ success: true, message: 'Member created', data: member });
  }

  @Delete('me/members/:memberId')
  @UseGuards(OrgAdminGuard)
  async removeMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    await this.organizationService.removeMember(user.userId, user.orgId, memberId);
    return res.status(200).json({ success: true, message: 'Member removed', data: null });
  }

  @Put('me/plan')
  @UseGuards(OrgAdminGuard)
  async changePlan(@CurrentUser() user: any, @Body() body: { plan: string }, @Res() res: Response) {
    const result = await this.organizationService.changePlan(user.userId, user.orgId, body.plan);
    return res.status(200).json({ success: true, message: result.message, data: result });
  }
}

// ── Roles Controller ──────────────────────────────────────────────────────────

@Controller('api/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  async list(@CurrentUser() user: any, @Res() res: Response) {
    const roles = await this.organizationService.listRoles(user.orgId);
    return res.status(200).json({ success: true, data: roles });
  }

  @Post()
  @UseGuards(OrgAdminGuard)
  async create(@CurrentUser() user: any, @Body() body: any, @Res() res: Response) {
    if (!user.orgId) throw AppError.forbidden('Organization context required');
    const role = await this.organizationService.createRole(user.orgId, body);
    return res.status(201).json({ success: true, message: 'Role created', data: role });
  }

  @Put(':id')
  @UseGuards(OrgAdminGuard)
  async update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any, @Res() res: Response) {
    const role = await this.organizationService.updateRole(id, user.orgId, body);
    return res.status(200).json({ success: true, message: 'Role updated', data: role });
  }

  @Delete(':id')
  @UseGuards(OrgAdminGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    await this.organizationService.removeRole(id, user.orgId);
    return res.status(200).json({ success: true, message: 'Role deleted', data: null });
  }

  @Post('assign')
  @UseGuards(OrgAdminGuard)
  async assign(@CurrentUser() user: any, @Body() body: any, @Res() res: Response) {
    const result = await this.organizationService.assignRole(user.orgId, body);
    return res.status(200).json({ success: true, message: 'Role assigned', data: result });
  }
}

