const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;

            // Solo permitir correos del dominio autorizado (opcional)
            // if (!email.endsWith('@marfund.org')) return done(null, false);

            // Buscar por correo electrónico para enlazar cuentas creadas manualmente o importadas
            const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

            if (rows.length > 0) {
                // Usuario existente: actualizar datos de Google (asegurando tener el google_id real)
                await db.query(
                    'UPDATE users SET google_id = ?, full_name = ?, avatar_url = ? WHERE email = ?',
                    [profile.id, profile.displayName, profile.photos[0]?.value, email]
                );
                return done(null, rows[0]);
            } else {
                // Nuevo usuario: Rechazar si no está previamente registrado en la BD
                return done(null, false, { message: 'unregistered' });
            }
        } catch (error) {
            return done(error, null);
        }
    }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, rows[0]);
    } catch (error) {
        done(error, null);
    }
});
