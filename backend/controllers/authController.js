const passport = require('passport');

exports.googleLogin = passport.authenticate('google', { scope: ['profile', 'email'] });

exports.googleCallback = (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err) {
            console.error("Google Auth Error:", err.message || err);
            return res.redirect(`${process.env.APP_URL}/login?error=oauth_failed`);
        }
        if (!user) {
            if (info && info.message === 'unregistered') {
                return res.redirect(`${process.env.APP_URL}/login?error=unregistered`);
            }
            return res.redirect(`${process.env.APP_URL}/login?error=true`);
        }
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error("Login Error:", loginErr);
                return res.redirect(`${process.env.APP_URL}/login?error=login_failed`);
            }
            return res.redirect(`${process.env.APP_URL}/dashboard`);
        });
    })(req, res, next);
};

exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.clearCookie('vacation_system_cookie');
            res.json({ message: 'Sesión cerrada correctamente' });
        });
    });
};

exports.getCurrentUser = (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ message: 'No autenticado' });
    }
};
