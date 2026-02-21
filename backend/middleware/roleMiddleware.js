exports.requireRole = (...roles) => (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Sin permisos para esta acción' });
    }
    next();
};
