import express from 'express';
import {
  listFarmers,
  deleteFarmer,
  listAgronomists,
  deleteAgronomist,
  getOutbreakAlerts,
} from '../controllers/admin.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect, authorizeRoles('admin'));

// --- Farmer Management ---
router.get('/farmers', listFarmers);
router.delete('/farmers/:id', deleteFarmer);

// --- Agronomist Management (approvals) ---
router.get('/agronomists', listAgronomists);
router.delete('/agronomists/:id', deleteAgronomist);

// --- Disease Outbreak Monitoring ---
router.get('/outbreak-alerts', getOutbreakAlerts);

export default router;
