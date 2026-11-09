import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "./db";
import { config } from "./config";

declare global {
  namespace Express {
    interface User { id: number; name: string; email: string; avatar?: string }
  }
}

if (config.googleId && config.googleSecret) {
  passport.use(new GoogleStrategy({
    clientID: config.googleId, clientSecret: config.googleSecret,
    callbackURL: config.googleCallback
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error("Google account did not provide an email"));
      const name = profile.displayName || email;
      const avatar = profile.photos?.[0]?.value || "";
      await pool.execute(
        `INSERT INTO users (google_id,name,email,avatar) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE google_id=VALUES(google_id), name=VALUES(name), avatar=VALUES(avatar)`,
        [profile.id, name, email, avatar]
      );
      const [rows] = await pool.execute<any[]>("SELECT id,name,email,avatar FROM users WHERE email=?", [email]);
      done(null, rows[0]);
    } catch (e) { done(e as Error); }
  }));
}
passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: number, done) => {
  try {
    const [rows] = await pool.execute<any[]>("SELECT id,name,email,avatar FROM users WHERE id=?", [id]);
    done(null, rows[0] || false);
  } catch (e) { done(e as Error); }
});
export default passport;
