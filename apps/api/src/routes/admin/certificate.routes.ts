import { Router } from 'express';
import * as adminCertificateController from '../../controllers/admin/certificate.controllers.js';

export const adminCertificateRoutes: Router = Router();

adminCertificateRoutes.get('/delivery', adminCertificateController.getDelivery);
adminCertificateRoutes.post('/send', adminCertificateController.sendCertificates);
