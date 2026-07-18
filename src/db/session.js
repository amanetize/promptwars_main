import crypto from 'node:crypto';

const COOKIE_NAME = 'pw_uid';
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

// Anonymous per-browser identity: no login required, but every route can
// scope its queries by req.userId, which is server-derived and never
// trusted from the request body — this is what makes per-user data
// isolation genuinely enforceable rather than assumed.
export function sessionMiddleware(req, res, next) {
  let userId = req.cookies?.[COOKIE_NAME];
  if (!userId) {
    userId = crypto.randomUUID();
    res.cookie(COOKIE_NAME, userId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: ONE_YEAR_MS,
    });
  }
  req.userId = userId;
  next();
}
