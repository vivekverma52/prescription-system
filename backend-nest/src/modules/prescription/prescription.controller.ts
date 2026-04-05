import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { PrescriptionService } from './prescription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { S3Service } from '../../common/s3/s3.service';
import { AppError } from '../../common/errors/app.error';

// ── Prescriptions Controller ──────────────────────────────────────────────────

@Controller('api/prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only images and PDFs are allowed'), false);
        }
      },
    }),
  )
  async create(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    await this.prescriptionService.assertSubscriptionLimit(user.orgId);

    let imageFile: any = null;
    if (file) {
      const url = await this.s3Service.uploadToS3(file.buffer, file.originalname, file.mimetype);
      imageFile = { location: url };
    }

    const prescription = await this.prescriptionService.createPrescription({
      userId: user.userId,
      userName: user.name,
      orgId: user.orgId,
      patient_name: body.patient_name,
      patient_phone: body.patient_phone,
      language: body.language,
      notes: body.notes,
      imageFile,
    });
    return res.status(201).json({ success: true, message: 'Prescription created', data: prescription });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: any, @Res() res: Response) {
    const rows = await this.prescriptionService.listPrescriptions({
      role: user.role,
      userId: user.userId,
      orgId: user.orgId,
    });
    return res.status(200).json({ success: true, data: rows });
  }

  @Get('public/:token')
  async getPublic(@Param('token') token: string, @Res() res: Response) {
    const prescription = await this.prescriptionService.getPublicPrescription(token);
    return res.status(200).json({ success: true, data: prescription });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const prescription = await this.prescriptionService.getPrescriptionById(id, {
      role: user.role,
      userId: user.userId,
      orgId: user.orgId,
    });
    return res.status(200).json({ success: true, data: prescription });
  }

  @Put(':id/render')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updateRender(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { video_url?: string },
    @Res() res: Response,
  ) {
    const prescription = await this.prescriptionService.updateRender(id, user.userId, body.video_url);
    return res.status(200).json({ success: true, message: 'Prescription updated', data: prescription });
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { status: string },
    @Res() res: Response,
  ) {
    const result = await this.prescriptionService.updateStatus(id, {
      userId: user.userId,
      role: user.role,
      orgId: user.orgId,
      status: body.status,
    });
    return res.status(200).json({ success: true, message: result.message, data: result });
  }

  @Put(':id/interpreted-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'PHARMACIST')
  async saveInterpretedData(
    @Param('id') id: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const result = await this.prescriptionService.saveInterpretedData(id, body);
    return res.status(200).json({ success: true, message: result.message });
  }

  @Get('medicines/search')
  @UseGuards(JwtAuthGuard)
  async searchMedicines(@Query('q') q: string, @Res() res: Response) {
    const results = this.prescriptionService.searchMedicines(q || '');
    return res.status(200).json({ success: true, data: results });
  }

  @Post(':id/medicines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async addMedicine(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const result = await this.prescriptionService.addMedicineToRx(id, user.userId, body);
    return res.status(201).json({ success: true, message: 'Medicine added', data: result });
  }

  @Put(':id/medicines/:medId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async updateMedicine(
    @Param('id') id: string,
    @Param('medId') medId: string,
    @CurrentUser() user: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const result = await this.prescriptionService.updateMedicineInRx(id, medId, body);
    return res.status(200).json({ success: true, message: 'Medicine updated', data: result });
  }

  @Delete(':id/medicines/:medId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PHARMACIST')
  async deleteMedicine(
    @Param('id') id: string,
    @Param('medId') medId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    await this.prescriptionService.deleteMedicineFromRx(id, medId);
    return res.status(200).json({ success: true, message: 'Medicine removed', data: null });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  async remove(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    await this.prescriptionService.removePrescription(id, user.userId);
    return res.status(200).json({ success: true, message: 'Prescription deleted', data: null });
  }
}

// ── Medicine Prescriptions Controller (Library) ───────────────────────────────

@Controller('api/medicine-prescriptions')
@UseGuards(JwtAuthGuard)
export class MedicinePrescriptionsController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  async create(@Body() body: any, @Res() res: Response) {
    const doc = await this.prescriptionService.createMedicineLibraryEntry(body);
    return res.status(201).json({ success: true, message: 'Medicine prescription created', data: doc });
  }

  @Get()
  async list(@Query() query: any, @Res() res: Response) {
    const result = await this.prescriptionService.listMedicineLibrary(query);
    return res.status(200).json({ success: true, data: result });
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.prescriptionService.getMedicineLibraryById(id);
    return res.status(200).json({ success: true, data: doc });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Res() res: Response) {
    const doc = await this.prescriptionService.updateMedicineLibraryEntry(id, body);
    return res.status(200).json({ success: true, message: 'Medicine prescription updated', data: doc });
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only images and PDFs are allowed'), false);
        }
      },
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!file) throw AppError.badRequest('No image file provided');
    const url = await this.s3Service.uploadToS3(file.buffer, file.originalname, file.mimetype);
    const doc = await this.prescriptionService.updateMedicineLibraryImage(id, url);
    return res.status(200).json({ success: true, message: 'Image uploaded', data: doc });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    await this.prescriptionService.removeMedicineLibraryEntry(id);
    return res.status(200).json({ success: true, message: 'Medicine prescription deleted', data: null });
  }
}
