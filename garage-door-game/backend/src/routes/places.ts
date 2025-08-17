import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { googleApiService } from '../services/googleApiService';

const router = express.Router();

// Allowlist of origins
const ALLOWED_ORIGINS = new Set<string>([
  'https://itsgarages.itsfait.com'
]);

// Optionally include Cloud Run frontend URL from env
if (process.env.FRONTEND_ORIGIN) {
  ALLOWED_ORIGINS.add(process.env.FRONTEND_ORIGIN);
}

// Simple origin check middleware
function originCheck(req: Request, res: Response, next: NextFunction): Response | void {
  const originHeader = (req.headers.origin || req.get('referer') || '').toString().replace(/\/$/, '');
  if (!originHeader) return res.status(403).json({ success: false, error: 'Origin required' });
  // Support comma-separated FRONTEND_ORIGIN values (e.g., custom domain + run.app URL)
  const dynamicAllowed = new Set<string>(ALLOWED_ORIGINS);
  const envOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const o of envOrigins) dynamicAllowed.add(o);
  for (const allowed of dynamicAllowed) {
    if (originHeader.startsWith(allowed)) return next();
  }
  return res.status(403).json({ success: false, error: 'Origin not allowed' });
}

// Per-IP rate limiting: 60 req/min
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Validate query string for autocomplete
function validateAutocompleteQuery(req: Request, res: Response, next: NextFunction): Response | void {
  const q = (req.query.q as string || '').trim();
  const limit = Math.min(parseInt((req.query.limit as string) || '8', 10), 10);
  if (!q || q.length < 3) return res.status(400).json({ success: false, error: 'Query must be at least 3 characters' });
  if (!/^[\p{L}\p{N}\s,.'-]+$/u.test(q)) return res.status(400).json({ success: false, error: 'Invalid characters in query' });
  (req as any).autocompleteLimit = isNaN(limit) ? 8 : limit;
  return next();
}

// Validate placeId input
function validateDetailsQuery(req: Request, res: Response, next: NextFunction): Response | void {
  const placeId = (req.query.placeId as string || '').trim();
  if (!placeId) return res.status(400).json({ success: false, error: 'placeId is required' });
  if (!/^[A-Za-z0-9_-]+$/.test(placeId)) return res.status(400).json({ success: false, error: 'Invalid placeId' });
  return next();
}

router.get('/autocomplete', originCheck, limiter, validateAutocompleteQuery, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string).trim();
    const limit = (req as any).autocompleteLimit as number;
    const suggestions = await googleApiService.placesAutocomplete(q, limit);
    res.json({ success: true, data: suggestions });
  } catch (err: any) {
    const msg = err?.message || 'Autocomplete failed';
    const code = typeof err?.status === 'number' ? err.status : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

router.get('/details', originCheck, limiter, validateDetailsQuery, async (req: Request, res: Response) => {
  try {
    const placeId = (req.query.placeId as string).trim();
    const details = await googleApiService.placeDetails(placeId);
    if (!details) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: details });
  } catch (err: any) {
    const msg = err?.message || 'Details failed';
    const code = typeof err?.status === 'number' ? err.status : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

export default router;

