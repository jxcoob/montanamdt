function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    // Check session age (48 hours)
    const loginTime = req.session.loginTime || 0;
    const elapsed   = Date.now() - loginTime;
    if (elapsed > 48 * 60 * 60 * 1000) {
        req.session.destroy();
        return res.redirect('/login?expired=1');
    }
    next();
}

module.exports = { requireAuth };
