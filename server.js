import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import Stripe from 'stripe';
import { createOpenAIChatCompletion, transcribeOpenAIAudio } from './server/openai/openai-client.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env['APP_URL'] || 'http://localhost:3000';
const JWT_SECRET = process.env['JWT_SECRET'] || 'change-me-in-env';
const OPENAI_API_KEY = process.env['OPENAI_API_KEY'];
const OPENAI_MODEL = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
const OPENAI_STT_MODEL = process.env['OPENAI_STT_MODEL'] || 'gpt-4o-mini-transcribe';
const STRIPE_SECRET_KEY = process.env['STRIPE_SECRET_KEY'];
const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'];
const GOOGLE_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET'];
const GOOGLE_REDIRECT_URI = process.env['GOOGLE_REDIRECT_URI'];
const TOKEN_COOKIE_NAME = 'token';
const OAUTH_STATE_COOKIE_NAME = 'oauth_state';
const isProduction = process.env['NODE_ENV'] === 'production';
const DATA_FILE = path.join(__dirname, 'user_data.json');
const DIST_DIR = path.join(__dirname, 'dist');
const staticCandidates = [path.join(DIST_DIR, 'browser'), DIST_DIR];
const STATIC_DIR = staticCandidates.find((candidate) => fs.existsSync(candidate));
const INDEX_FILE = STATIC_DIR ? path.join(STATIC_DIR, 'index.html') : '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const originList = APP_URL.split(',').map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = new Set(originList.length > 0 ? originList : ['http://localhost:3000']);
const primaryAppUrl = originList[0] || 'http://localhost:3000';
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_PER_ATTACHMENT = 14000;
const MAX_TOTAL_ATTACHMENT_TEXT = 80000;
const MIN_TEXT_BUDGET_PER_ATTACHMENT = 700;
const getDefaultData = () => ({
    users: []
});
const sanitizeUser = (user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    xp: user.xp,
    level: user.level,
    plan: user.plan,
    unlockedAchievements: user.unlockedAchievements,
    history: user.history,
    preferredLanguage: user.preferredLanguage
});
const hashPassword = (password) => createHash('sha256').update(password).digest('hex');
const normalizeEmail = (email) => email.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalizePlan = (value) => value === 'pro' ? 'pro' : 'free';
const SUPPORTED_LANGUAGE_CODES = new Set([
    'ar', 'en', 'fr', 'es', 'de', 'it', 'pt', 'tr', 'ru', 'zh',
    'ja', 'ko', 'hi', 'id', 'ms', 'ur', 'nl', 'pl', 'sv', 'he'
]);
const LANGUAGE_NAME_BY_CODE = {
    ar: 'Arabic',
    en: 'English',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    tr: 'Turkish',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    hi: 'Hindi',
    id: 'Indonesian',
    ms: 'Malay',
    ur: 'Urdu',
    nl: 'Dutch',
    pl: 'Polish',
    sv: 'Swedish',
    he: 'Hebrew'
};
const normalizePreferredLanguage = (value) => typeof value === 'string' && SUPPORTED_LANGUAGE_CODES.has(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : 'ar';
const parseCsvEmails = (raw) => {
    if (!raw || typeof raw !== 'string') {
        return [];
    }
    return raw
        .split(',')
        .map((value) => normalizeEmail(value))
        .filter(Boolean);
};
const permanentProEmailSet = new Set([
    normalizeEmail('ahmad123123gg5@gmail.com'),
    ...parseCsvEmails(process.env['PERMANENT_PRO_EMAILS']),
    ...parseCsvEmails(process.env['FREE_PRO_EMAILS']),
    ...parseCsvEmails(process.env['FREE_ADMIN_EMAIL'])
]);
const isPermanentProEmail = (email) => permanentProEmailSet.has(normalizeEmail(email));
const enforcePermanentProPlan = (user) => {
    const desiredPlan = isPermanentProEmail(user.email) ? 'pro' : normalizePlan(user.plan);
    if (user.plan === desiredPlan) {
        return false;
    }
    user.plan = desiredPlan;
    user.updatedAt = new Date().toISOString();
    return true;
};
const cloneData = (data) => JSON.parse(JSON.stringify(data));
const normalizeUser = (raw) => {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const obj = raw;
    const id = typeof obj['id'] === 'string' ? obj['id'] : '';
    const email = typeof obj['email'] === 'string' ? normalizeEmail(obj['email']) : '';
    const name = typeof obj['name'] === 'string' ? obj['name'] : '';
    if (!id || !email || !name) {
        return null;
    }
    const now = new Date().toISOString();
    const provider = obj['authProvider'] === 'google' ? 'google' : 'local';
    const unlockedAchievements = Array.isArray(obj['unlockedAchievements'])
        ? obj['unlockedAchievements'].filter((entry) => typeof entry === 'string')
        : [];
    const history = Array.isArray(obj['history']) ? obj['history'] : [];
    return {
        id,
        email,
        name,
        xp: typeof obj['xp'] === 'number' && Number.isFinite(obj['xp'])
            ? Math.max(0, Math.floor(obj['xp']))
            : 0,
        level: typeof obj['level'] === 'number' && Number.isFinite(obj['level'])
            ? Math.max(1, Math.floor(obj['level']))
            : 1,
        plan: normalizePlan(obj['plan']),
        unlockedAchievements,
        history,
        preferredLanguage: normalizePreferredLanguage(obj['preferredLanguage']),
        passwordHash: typeof obj['passwordHash'] === 'string' ? obj['passwordHash'] : undefined,
        authProvider: provider,
        createdAt: typeof obj['createdAt'] === 'string' ? obj['createdAt'] : now,
        updatedAt: typeof obj['updatedAt'] === 'string' ? obj['updatedAt'] : now
    };
};
const normalizeData = (raw) => {
    if (!raw || typeof raw !== 'object') {
        return getDefaultData();
    }
    const obj = raw;
    const users = Array.isArray(obj['users'])
        ? obj['users'].map(normalizeUser).filter((user) => Boolean(user))
        : [];
    return {
        users
    };
};
const ensureDataFile = async () => {
    if (fs.existsSync(DATA_FILE)) {
        return;
    }
    await fs.promises.writeFile(DATA_FILE, JSON.stringify(getDefaultData(), null, 2), 'utf8');
};
const readDataSafe = async () => {
    await ensureDataFile();
    try {
        const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
        if (!raw.trim()) {
            return getDefaultData();
        }
        const parsed = JSON.parse(raw);
        return normalizeData(parsed);
    }
    catch (error) {
        console.error('Failed to read user_data.json:', error);
        return getDefaultData();
    }
};
const writeDataSafe = async (data) => {
    const tempFile = `${DATA_FILE}.tmp`;
    const payload = JSON.stringify(cloneData(data), null, 2);
    try {
        await fs.promises.writeFile(tempFile, payload, 'utf8');
        await fs.promises.rename(tempFile, DATA_FILE);
    }
    catch (error) {
        console.error('Failed to write user_data.json:', error);
        try {
            if (fs.existsSync(tempFile)) {
                await fs.promises.unlink(tempFile);
            }
        }
        catch {
            // noop
        }
        throw new Error('Failed to persist user data');
    }
};
const setAuthCookie = (res, token) => {
    res.cookie(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });
};
const clearAuthCookie = (res) => {
    res.clearCookie(TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    });
};
const setOAuthStateCookie = (res, value) => {
    res.cookie(OAUTH_STATE_COOKIE_NAME, value, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/'
    });
};
const clearOAuthStateCookie = (res) => {
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    });
};
const getRequestOrigin = (req) => {
    const forwardedProto = req.header('x-forwarded-proto');
    const protocol = typeof forwardedProto === 'string' && forwardedProto.trim()
        ? forwardedProto.split(',')[0].trim()
        : req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    return `${protocol}://${host}`;
};
const getGoogleRedirectUri = (_req) => {
    if (typeof GOOGLE_REDIRECT_URI === 'string' && GOOGLE_REDIRECT_URI.trim()) {
        return GOOGLE_REDIRECT_URI.trim();
    }
    if (!isProduction) {
        return `http://localhost:${PORT}/api/auth/oauth/google/callback`;
    }
    try {
        return new URL('/api/auth/oauth/google/callback', primaryAppUrl).toString();
    }
    catch {
        return `${primaryAppUrl}/api/auth/oauth/google/callback`;
    }
};
const sendOAuthPopupResult = (res, status, provider, message) => {
    const payload = JSON.stringify({
        source: 'smartedge-oauth',
        status,
        provider,
        message
    });
    const targetOrigin = JSON.stringify(primaryAppUrl);
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>OAuth</title></head>
<body>
<script>
  (function () {
    var payload = ${payload};
    var targetOrigin = ${targetOrigin};
    try {
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage(payload, targetOrigin);
      }
    } catch (error) {}
    if (payload.status === 'success') {
      window.close();
      if (!window.closed) {
        window.location.href = targetOrigin;
      }
      return;
    }
    document.body.textContent = payload.message || 'OAuth failed';
  })();
</script>
</body>
</html>`;
    res.status(status === 'success' ? 200 : 400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
};
const upsertOAuthUser = async (provider, email, name) => {
    const data = await readDataSafe();
    const now = new Date().toISOString();
    const normalizedEmail = normalizeEmail(email);
    const displayName = name.trim() || normalizedEmail.split('@')[0] || `${provider} user`;
    let user = data.users.find((entry) => entry.email === normalizedEmail);
    if (!user) {
        user = {
            id: randomUUID(),
            email: normalizedEmail,
            name: displayName,
            xp: 0,
            level: 1,
            plan: isPermanentProEmail(normalizedEmail) ? 'pro' : 'free',
            unlockedAchievements: [],
            history: [],
            authProvider: provider,
            createdAt: now,
            updatedAt: now
        };
        data.users.push(user);
    }
    else {
        user.name = displayName || user.name;
        user.authProvider = provider;
        user.updatedAt = now;
    }
    enforcePermanentProPlan(user);
    await writeDataSafe(data);
    return user;
};
const createAuthToken = (user) => jwt.sign({
    id: user.id,
    email: user.email
}, JWT_SECRET, { expiresIn: '7d' });
const authenticate = (req, res, next) => {
    const token = req.cookies?.[TOKEN_COOKIE_NAME];
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded?.id || !decoded?.email) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        req.user = {
            id: decoded.id,
            email: decoded.email
        };
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};
const asyncHandler = (handler) => (req, res, next) => {
    void handler(req, res, next).catch(next);
};
app.disable('x-powered-by');
app.use(express.json({ limit: '100mb' }));
app.use(cookieParser());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        res.status(400).json({ error: 'email, password, and name are required' });
        return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
        res.status(400).json({ error: 'Invalid email address' });
        return;
    }
    if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
    }
    const normalizedName = name.trim();
    if (!normalizedName) {
        res.status(400).json({ error: 'Name is required' });
        return;
    }
    const data = await readDataSafe();
    const existingUser = data.users.find((user) => user.email === normalizedEmail);
    if (existingUser) {
        res.status(409).json({ error: 'User already exists' });
        return;
    }
    const now = new Date().toISOString();
    const newUser = {
        id: randomUUID(),
        email: normalizedEmail,
        name: normalizedName,
        xp: 0,
        level: 1,
        plan: isPermanentProEmail(normalizedEmail) ? 'pro' : 'free',
        unlockedAchievements: [],
        history: [],
        passwordHash: hashPassword(password),
        authProvider: 'local',
        createdAt: now,
        updatedAt: now
    };
    data.users.push(newUser);
    await writeDataSafe(data);
    const token = createAuthToken(newUser);
    setAuthCookie(res, token);
    res.status(201).json({ user: sanitizeUser(newUser) });
}));
app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'email and password are required' });
        return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
        res.status(400).json({ error: 'Invalid email address' });
        return;
    }
    if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
    }
    const data = await readDataSafe();
    const user = data.users.find((entry) => entry.email === normalizedEmail);
    if (!user) {
        res.status(404).json({ error: 'Account not found. Please create an account first.' });
        return;
    }
    if (user.authProvider !== 'local' || !user.passwordHash) {
        res.status(400).json({ error: 'Password login is not available for this account. Use Google sign-in.' });
        return;
    }
    if (hashPassword(password) !== user.passwordHash) {
        res.status(401).json({ error: 'Incorrect password' });
        return;
    }
    user.updatedAt = new Date().toISOString();
    enforcePermanentProPlan(user);
    await writeDataSafe(data);
    const token = createAuthToken(user);
    setAuthCookie(res, token);
    res.json({ user: sanitizeUser(user) });
}));
app.post('/api/auth/change-password', authenticate, asyncHandler(async (req, res) => {
    const authReq = req;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'currentPassword and newPassword are required' });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters' });
        return;
    }
    const data = await readDataSafe();
    const user = data.users.find((entry) => entry.id === authReq.user?.id);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    if (user.authProvider !== 'local' || !user.passwordHash) {
        res.status(400).json({ error: 'Password change is only available for email/password accounts' });
        return;
    }
    if (hashPassword(currentPassword) !== user.passwordHash) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
    }
    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    await writeDataSafe(data);
    res.json({ success: true });
}));
app.get('/api/auth/oauth/google/start', (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        res.status(500).json({ error: 'Google OAuth is not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)' });
        return;
    }
    const state = jwt.sign({ provider: 'google', nonce: randomUUID() }, JWT_SECRET, { expiresIn: '10m' });
    setOAuthStateCookie(res, state);
    const redirectUri = getGoogleRedirectUri(req);
    const query = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        access_type: 'offline',
        state
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`);
});
app.get('/api/auth/oauth/google/callback', asyncHandler(async (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        sendOAuthPopupResult(res, 'error', 'google', 'Google OAuth is not configured on the server');
        return;
    }
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
    const state = typeof req.query['state'] === 'string' ? req.query['state'] : '';
    const cookieState = typeof req.cookies?.[OAUTH_STATE_COOKIE_NAME] === 'string'
        ? req.cookies[OAUTH_STATE_COOKIE_NAME]
        : '';
    clearOAuthStateCookie(res);
    if (!code || !state || !cookieState || state !== cookieState) {
        sendOAuthPopupResult(res, 'error', 'google', 'OAuth state validation failed. Please try again.');
        return;
    }
    try {
        jwt.verify(state, JWT_SECRET);
    }
    catch {
        sendOAuthPopupResult(res, 'error', 'google', 'OAuth session expired. Please try again.');
        return;
    }
    try {
        const redirectUri = getGoogleRedirectUri(req);
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            })
        });
        const tokenPayload = (await tokenResponse.json().catch(() => null));
        if (!tokenResponse.ok) {
            const message = typeof tokenPayload?.['error_description'] === 'string'
                ? tokenPayload.error_description
                : 'Failed to exchange Google authorization code';
            sendOAuthPopupResult(res, 'error', 'google', message);
            return;
        }
        const accessToken = typeof tokenPayload?.['access_token'] === 'string' ? tokenPayload.access_token : '';
        if (!accessToken) {
            sendOAuthPopupResult(res, 'error', 'google', 'Google did not return an access token');
            return;
        }
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const profilePayload = (await profileResponse.json().catch(() => null));
        if (!profileResponse.ok) {
            sendOAuthPopupResult(res, 'error', 'google', 'Failed to fetch Google user profile');
            return;
        }
        const email = typeof profilePayload?.['email'] === 'string' ? normalizeEmail(profilePayload.email) : '';
        const name = typeof profilePayload?.['name'] === 'string' ? profilePayload.name : '';
        const emailVerified = Boolean(profilePayload?.['email_verified']);
        if (!email || !isValidEmail(email)) {
            sendOAuthPopupResult(res, 'error', 'google', 'Google account email is missing or invalid');
            return;
        }
        if (!emailVerified) {
            sendOAuthPopupResult(res, 'error', 'google', 'Google account email is not verified');
            return;
        }
        const user = await upsertOAuthUser('google', email, name);
        const token = createAuthToken(user);
        setAuthCookie(res, token);
        sendOAuthPopupResult(res, 'success', 'google', `Signed in successfully as ${user.email}`);
    }
    catch (error) {
        console.error('Google OAuth callback failed:', error);
        sendOAuthPopupResult(res, 'error', 'google', 'Google login failed. Please try again.');
    }
}));
app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    clearOAuthStateCookie(res);
    res.json({ success: true });
});
app.get('/api/auth/me', authenticate, asyncHandler(async (req, res) => {
    const authReq = req;
    const data = await readDataSafe();
    const user = data.users.find((entry) => entry.id === authReq.user?.id);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    if (enforcePermanentProPlan(user)) {
        await writeDataSafe(data);
    }
    res.json({ user: sanitizeUser(user) });
}));
const mapHistoryRole = (role) => {
    if (role === 'assistant' || role === 'model') {
        return 'assistant';
    }
    if (role === 'system') {
        return 'system';
    }
    return 'user';
};
const toHistoryMessages = (history) => {
    if (!Array.isArray(history)) {
        return [];
    }
    const messages = [];
    for (const item of history) {
        const textFromParts = Array.isArray(item?.parts)
            ? item.parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('\n')
            : '';
        const content = typeof item?.content === 'string' && item.content.trim()
            ? item.content.trim()
            : textFromParts.trim();
        if (!content) {
            continue;
        }
        messages.push({
            role: mapHistoryRole(item?.role),
            content
        });
    }
    return messages;
};
const sanitizeMimeType = (value) => {
    if (typeof value !== 'string') {
        return 'application/octet-stream';
    }
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)
        ? normalized
        : 'application/octet-stream';
};
const sanitizeFileName = (value, fallback) => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return fallback;
    }
    return trimmed.slice(0, 120);
};
const stripDataUrlPrefix = (value) => {
    const trimmed = value.trim();
    const marker = 'base64,';
    const markerIndex = trimmed.indexOf(marker);
    const cleanValue = markerIndex >= 0 ? trimmed.slice(markerIndex + marker.length) : trimmed;
    return cleanValue.replace(/\s+/g, '');
};
const normalizeExtractedText = (value) => value
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const decodeLikelyTextBuffer = (buffer) => {
    const utf8Text = buffer.toString('utf8');
    const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;
    const replacementRatio = replacementCount / Math.max(1, utf8Text.length);
    if (replacementRatio > 0.02) {
        return normalizeExtractedText(buffer.toString('latin1'));
    }
    return normalizeExtractedText(utf8Text);
};
const extractPrintableText = (buffer) => {
    const candidates = [buffer.toString('utf8'), buffer.toString('latin1')];
    let best = '';
    for (const candidate of candidates) {
        const chunks = candidate.match(/[A-Za-z0-9\u0600-\u06FF][A-Za-z0-9\u0600-\u06FF\s.,;:!?()'"`~@#$%^&*_=+\-\/\\|[\]{}<>]{18,}/g) ||
            [];
        const combined = chunks.join('\n');
        if (combined.length > best.length) {
            best = combined;
        }
    }
    return normalizeExtractedText(best);
};
const decodePdfEscapedString = (value) => {
    let result = '';
    for (let i = 0; i < value.length; i += 1) {
        const char = value[i];
        if (char !== '\\') {
            result += char;
            continue;
        }
        i += 1;
        if (i >= value.length) {
            break;
        }
        const escaped = value[i];
        switch (escaped) {
            case 'n':
                result += '\n';
                break;
            case 'r':
                result += '\r';
                break;
            case 't':
                result += '\t';
                break;
            case 'b':
                result += '\b';
                break;
            case 'f':
                result += '\f';
                break;
            case '(':
            case ')':
            case '\\':
                result += escaped;
                break;
            case '\r':
                if (value[i + 1] === '\n') {
                    i += 1;
                }
                break;
            case '\n':
                break;
            default:
                if (/[0-7]/.test(escaped)) {
                    let octal = escaped;
                    for (let j = 0; j < 2 && /[0-7]/.test(value[i + 1] || ''); j += 1) {
                        i += 1;
                        octal += value[i];
                    }
                    result += String.fromCharCode(parseInt(octal, 8));
                }
                else {
                    result += escaped;
                }
                break;
        }
    }
    return result;
};
const decodePdfHexString = (value) => {
    const cleanHex = value.replace(/\s+/g, '');
    if (!cleanHex || !/^[0-9a-fA-F]+$/.test(cleanHex)) {
        return '';
    }
    const normalized = cleanHex.length % 2 === 0 ? cleanHex : `${cleanHex}0`;
    try {
        return Buffer.from(normalized, 'hex').toString('utf8');
    }
    catch {
        return '';
    }
};
const extractPdfText = (buffer) => {
    const source = buffer.toString('latin1');
    const pieces = [];
    const literalRegex = /\((?:\\.|[^\\()])*\)\s*Tj/g;
    const arrayRegex = /\[((?:\\.|[^\]])*?)\]\s*TJ/gs;
    const hexRegex = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let match;
    while ((match = literalRegex.exec(source)) !== null) {
        const token = match[0];
        const openIndex = token.indexOf('(');
        const closeIndex = token.lastIndexOf(')');
        if (openIndex === -1 || closeIndex <= openIndex) {
            continue;
        }
        const decoded = decodePdfEscapedString(token.slice(openIndex + 1, closeIndex));
        if (decoded.trim()) {
            pieces.push(decoded);
        }
    }
    while ((match = hexRegex.exec(source)) !== null) {
        const decoded = decodePdfHexString(match[1] || '');
        if (decoded.trim()) {
            pieces.push(decoded);
        }
    }
    while ((match = arrayRegex.exec(source)) !== null) {
        const items = (match[1] || '').match(/\((?:\\.|[^\\()])*\)|<([0-9A-Fa-f\s]+)>/g) || [];
        for (const item of items) {
            if (item.startsWith('(') && item.endsWith(')')) {
                const decoded = decodePdfEscapedString(item.slice(1, -1));
                if (decoded.trim()) {
                    pieces.push(decoded);
                }
                continue;
            }
            if (item.startsWith('<') && item.endsWith('>')) {
                const decoded = decodePdfHexString(item.slice(1, -1));
                if (decoded.trim()) {
                    pieces.push(decoded);
                }
            }
        }
    }
    if (pieces.length === 0) {
        return extractPrintableText(buffer);
    }
    return normalizeExtractedText(pieces.join('\n'));
};
const isImageMimeType = (mimeType) => mimeType.startsWith('image/');
const isTextMimeType = (mimeType) => {
    if (mimeType.startsWith('text/')) {
        return true;
    }
    return new Set([
        'application/json',
        'application/xml',
        'application/x-yaml',
        'application/yaml',
        'application/csv',
        'application/javascript',
        'application/typescript',
        'application/x-ndjson'
    ]).has(mimeType);
};
const extractAttachmentText = (buffer, mimeType, fileName) => {
    if (isTextMimeType(mimeType)) {
        return decodeLikelyTextBuffer(buffer);
    }
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        return extractPdfText(buffer);
    }
    return extractPrintableText(buffer);
};
const parseAttachments = (files) => {
    const parsed = {
        extractedText: '',
        imageParts: [],
        notes: []
    };
    if (!Array.isArray(files) || files.length === 0) {
        return parsed;
    }
    const allFiles = files;
    const extractedBlocks = [];
    let totalTextSize = 0;
    for (let index = 0; index < allFiles.length; index += 1) {
        const rawFile = allFiles[index];
        if (!rawFile || typeof rawFile !== 'object') {
            continue;
        }
        const file = rawFile;
        const fileName = sanitizeFileName(file.name, `file-${index + 1}`);
        const attachmentLabel = `Attachment #${index + 1}`;
        const mimeType = sanitizeMimeType(file.mimeType);
        if (typeof file.data !== 'string' || !file.data.trim()) {
            parsed.notes.push(`Skipped ${attachmentLabel} because data is empty.`);
            continue;
        }
        const base64 = stripDataUrlPrefix(file.data);
        let buffer;
        try {
            buffer = Buffer.from(base64, 'base64');
        }
        catch {
            parsed.notes.push(`Skipped ${attachmentLabel} because base64 data is invalid.`);
            continue;
        }
        if (!buffer.length) {
            parsed.notes.push(`Skipped ${attachmentLabel} because decoded content is empty.`);
            continue;
        }
        if (buffer.length > MAX_ATTACHMENT_BYTES) {
            parsed.notes.push(`Skipped ${attachmentLabel} because it exceeds ${(MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)}MB.`);
            continue;
        }
        if (isImageMimeType(mimeType)) {
            parsed.imageParts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${base64}`
                }
            });
            continue;
        }
        let extracted = extractAttachmentText(buffer, mimeType, fileName);
        if (!extracted) {
            parsed.notes.push(`Could not extract readable text from ${attachmentLabel}.`);
            continue;
        }
        const remaining = MAX_TOTAL_ATTACHMENT_TEXT - totalTextSize;
        if (remaining <= 0) {
            parsed.notes.push('Attachment text budget reached; extra text was truncated to fit model context.');
            break;
        }
        const remainingFiles = Math.max(1, allFiles.length - index);
        const dynamicPerFileBudget = Math.max(MIN_TEXT_BUDGET_PER_ATTACHMENT, Math.floor(remaining / remainingFiles));
        const perFileBudget = Math.min(MAX_TEXT_PER_ATTACHMENT, dynamicPerFileBudget, remaining);
        if (extracted.length > perFileBudget) {
            extracted = `${extracted.slice(0, perFileBudget)}\n...[truncated]`;
        }
        totalTextSize += extracted.length;
        extractedBlocks.push([
            `Document: ${index + 1}`,
            `MIME: ${mimeType}`,
            'Extracted content:',
            extracted
        ].join('\n'));
    }
    parsed.extractedText = extractedBlocks.join('\n\n---\n\n');
    return parsed;
};
const normalizeForMatch = (value) => value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
app.post(['/api/ai/chat', '/api/openai/chat'], asyncHandler(async (req, res) => {
    if (!OPENAI_API_KEY) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
    }
    const { message, systemInstruction, history, jsonMode = false, model, files, maxTokens } = req.body;
    if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
    }
    const messages = [];
    if (jsonMode) {
        messages.push({
            role: 'system',
            content: 'Return strictly valid JSON only. Do not include markdown fences or extra explanations.'
        });
    }
    if (typeof systemInstruction === 'string' && systemInstruction.trim()) {
        messages.push({
            role: 'system',
            content: systemInstruction.trim()
        });
    }
    messages.push(...toHistoryMessages(history));
    const parsedAttachments = parseAttachments(files);
    const userContent = [
        {
            type: 'text',
            text: message
        }
    ];
    if (parsedAttachments.extractedText) {
        userContent.push({
            type: 'text',
            text: [
                'Use the following extracted text from attached files as the main source when creating the answer/questions.',
                parsedAttachments.extractedText
            ].join('\n\n')
        });
    }
    if (parsedAttachments.imageParts.length > 0) {
        userContent.push(...parsedAttachments.imageParts);
    }
    if (parsedAttachments.notes.length > 0) {
        userContent.push({
            type: 'text',
            text: `Attachment parsing notes:\n- ${parsedAttachments.notes.join('\n- ')}`
        });
    }
    const firstUserPart = userContent[0];
    const userMessageContent = userContent.length === 1 && firstUserPart?.type === 'text'
        ? firstUserPart.text
        : userContent;
    messages.push({
        role: 'user',
        content: userMessageContent
    });
    const selectedModel = typeof model === 'string' && model.trim() ? model.trim() : OPENAI_MODEL;
    const parsedMaxTokens = typeof maxTokens === 'number' && Number.isFinite(maxTokens)
        ? Math.min(Math.max(64, Math.floor(maxTokens)), 4096)
        : undefined;
    const openAIRequestBody = {
        model: selectedModel,
        messages,
        temperature: jsonMode ? 0.1 : 0.7
    };
    if (parsedMaxTokens) {
        openAIRequestBody['max_tokens'] = parsedMaxTokens;
    }
    try {
        const text = await createOpenAIChatCompletion({
            apiKey: OPENAI_API_KEY,
            model: selectedModel,
            messages,
            temperature: jsonMode ? 0.1 : 0.7,
            maxTokens: parsedMaxTokens
        });
        res.json({ text });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'AI provider request failed';
        res.status(502).json({ error: message });
    }
}));
app.post(['/api/ai/image', '/api/openai/image'], (_req, res) => {
    res.status(410).json({
        error: 'Image generation is disabled'
    });
});
app.post(['/api/ai/transcribe', '/api/openai/transcribe'], asyncHandler(async (req, res) => {
    if (!OPENAI_API_KEY) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
    }
    const { base64Data, mimeType = 'audio/webm', fileName = 'audio.webm', model = OPENAI_STT_MODEL } = req.body;
    if (!base64Data || typeof base64Data !== 'string') {
        res.status(400).json({ error: 'base64Data is required' });
        return;
    }
    const cleanedBase64 = base64Data.includes(',') ? base64Data.split(',').pop() || '' : base64Data;
    let audioBuffer;
    try {
        audioBuffer = Buffer.from(cleanedBase64, 'base64');
    }
    catch {
        res.status(400).json({ error: 'Invalid base64Data' });
        return;
    }
    if (!audioBuffer.length) {
        res.status(400).json({ error: 'base64Data is empty' });
        return;
    }
    try {
        const text = await transcribeOpenAIAudio({
            apiKey: OPENAI_API_KEY,
            model,
            audioBuffer,
            mimeType,
            fileName
        });
        res.json({ text });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'AI transcription failed';
        res.status(502).json({ error: message });
    }
}));
app.post(['/api/ai/video', '/api/openai/video'], (_req, res) => {
    res.status(410).json({
        error: 'Video generation is disabled'
    });
});
app.post('/api/create-checkout-session', asyncHandler(async (req, res) => {
    if (!stripe) {
        res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured' });
        return;
    }
    const { planId, email } = req.body;
    const plans = {
        pro_monthly: {
            amount: 2900,
            interval: 'month',
            name: 'Pro Monthly Subscription'
        },
        pro_yearly: {
            amount: 29000,
            interval: 'year',
            name: 'Pro Yearly Subscription'
        }
    };
    const selectedPlan = planId ? plans[planId] : undefined;
    if (!selectedPlan) {
        res.status(400).json({ error: 'Invalid planId. Use pro_monthly or pro_yearly' });
        return;
    }
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: 'usd',
                    unit_amount: selectedPlan.amount,
                    recurring: {
                        interval: selectedPlan.interval
                    },
                    product_data: {
                        name: selectedPlan.name
                    }
                }
            }
        ],
        success_url: `${APP_URL}/subscription?success=true`,
        cancel_url: `${APP_URL}/subscription?canceled=true`
    });
    res.json({ id: session.id });
}));
app.get('/api/user/data', authenticate, asyncHandler(async (req, res) => {
    const authReq = req;
    const data = await readDataSafe();
    const user = data.users.find((entry) => entry.id === authReq.user?.id);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    if (enforcePermanentProPlan(user)) {
        await writeDataSafe(data);
    }
    res.json({ user: sanitizeUser(user) });
}));
app.post('/api/user/data', authenticate, asyncHandler(async (req, res) => {
    const authReq = req;
    const data = await readDataSafe();
    const user = data.users.find((entry) => entry.id === authReq.user?.id);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const updates = req.body;
    if (typeof updates.name === 'string' && updates.name.trim()) {
        user.name = updates.name.trim();
    }
    if (typeof updates.xp === 'number' && Number.isFinite(updates.xp)) {
        user.xp = Math.max(0, Math.floor(updates.xp));
    }
    if (typeof updates.level === 'number' && Number.isFinite(updates.level)) {
        user.level = Math.max(1, Math.floor(updates.level));
    }
    if (Array.isArray(updates.unlockedAchievements)) {
        user.unlockedAchievements = updates.unlockedAchievements.filter((entry) => typeof entry === 'string');
    }
    if (Array.isArray(updates.history)) {
        user.history = updates.history;
    }
    if (typeof updates.preferredLanguage === 'string' && updates.preferredLanguage.trim()) {
        user.preferredLanguage = normalizePreferredLanguage(updates.preferredLanguage);
    }
    enforcePermanentProPlan(user);
    user.updatedAt = new Date().toISOString();
    await writeDataSafe(data);
    res.json({ user: sanitizeUser(user) });
}));
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
});
if (STATIC_DIR && fs.existsSync(STATIC_DIR)) {
    app.use(express.static(STATIC_DIR));
}
app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        next();
        return;
    }
    if (!INDEX_FILE || !fs.existsSync(INDEX_FILE)) {
        res.status(404).json({ error: 'Frontend build not found. Expected dist/index.html' });
        return;
    }
    res.sendFile(INDEX_FILE);
});
app.use((err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) {
        return;
    }
    const errorObj = err;
    const status = typeof errorObj?.status === 'number' ? errorObj.status : 500;
    if (errorObj?.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'Invalid JSON payload' });
        return;
    }
    res.status(status).json({
        error: typeof errorObj?.message === 'string' ? errorObj.message : 'Internal server error'
    });
});
const start = async () => {
    await ensureDataFile();
    app.listen(PORT, () => {
        console.log('Server running on port ' + PORT);
        console.log(`Allowed CORS origins: ${Array.from(allowedOrigins).join(', ')}`);
        if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
            console.log(`Google OAuth redirect URI: ${getGoogleRedirectUri()}`);
        }
    });
};
void start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
export { app };
