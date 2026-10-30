import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// --- Import API Routes ---
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import cropRoutes from './routes/crop.routes.js';
import diseaseReportRoutes from './routes/diseaseReport.routes.js';
import agronomistRoutes from './routes/agronomist.routes.js';
import adminRoutes from './routes/admin.routes.js';
import mediaRoutes from './routes/media.routes.js';
import weatherRoutes from './routes/weather.routes.js';
import marketRoutes from './routes/market.routes.js';
import mlServerRoutes from './routes/mlServer.routes.js';
import geminiRoutes from './routes/gemini.routes.js';

// --- Import Error Middleware & Services ---
import { errorHandler } from './middleware/error.middleware.js';
import { isRedisReady } from './config/redis.js';

// --- Load environment variables ---
dotenv.config();

// --- Initialize Express ---
const app = express();

// --- Allowed origins for CORS ---
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://krishi-kavach.netlify.app',
  'https://krishi-kavach.netlify.app/',
  'https://krushikavach.netlify.app',
  'https://krushikavach.netlify.app/'
];

// --- Core Middleware ---
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (e.g., Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy does not allow access from ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- Health Check Endpoint ---
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    redis: isRedisReady() ? 'connected' : 'fallback_mode',
  });
});

// --- API Routes ---
app.use('/api/v1/auth', authRoutes);           // Auth: register, login, logout, refresh
app.use('/api/v1/users', userRoutes);          // User profile management
app.use('/api/v1/crops', cropRoutes);          // Farmer crop tracking
app.use('/api/v1/disease-reports', diseaseReportRoutes); // Disease detection & reports
app.use('/api/v1/agronomists', agronomistRoutes);        // Agronomist profiles & collaboration
app.use('/api/v1/admin', adminRoutes);         // Admin: manage farmers & agronomists
app.use('/api/v1/media', mediaRoutes);         // File/image uploads
app.use('/api/v1/weather', weatherRoutes);     // Weather data
app.use('/api/v1/market', marketRoutes);       // Market prices
app.use('/api/v1/ml-server', mlServerRoutes);  // ML model server status
app.use('/api/v1/disease-info', geminiRoutes); // Gemini AI: disease info & chatbot

// --- 404 Handler for unknown routes ---
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// --- Error Middleware ---
app.use(errorHandler);

export default app;
