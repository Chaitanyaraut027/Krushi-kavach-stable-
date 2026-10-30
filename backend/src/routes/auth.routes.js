import express from 'express';
import { register, login, refreshToken, logout } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { uploadSingle } from '../middleware/upload.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.post('/register', authLimiter, uploadSingle('idProof'), register);
router.post('/login', authLimiter, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);

export default router;
