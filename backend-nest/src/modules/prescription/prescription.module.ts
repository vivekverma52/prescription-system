import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrescriptionService } from './prescription.service';
import {
  PrescriptionsController,
  MedicinePrescriptionsController,
} from './prescription.controller';
import {
  MedicinePrescription,
  MedicinePrescriptionSchema,
} from './schemas/medicine-prescription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicinePrescription.name, schema: MedicinePrescriptionSchema },
    ]),
  ],
  controllers: [PrescriptionsController, MedicinePrescriptionsController],
  providers: [PrescriptionService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
