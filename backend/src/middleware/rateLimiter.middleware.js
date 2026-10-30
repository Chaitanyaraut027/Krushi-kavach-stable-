import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication routes (prevent brute-force login attempts)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // 20 requests per IP
  message: { message: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for AI & disease detection endpoints (prevent spamming ML models)
export const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 30,                  // 30 requests per IP
  message: { message: 'Too many detection requests, please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});
