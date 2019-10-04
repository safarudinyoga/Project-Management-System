module.exports = {
    isLoggedIn: (req, res, next) => {
        if (req.session.user) {
            next();
        } else {
            req.session.latestUrl = req.originalUrl;
            console.log(req.session.latestUrl);
            res.redirect('/login')
        }
    },

    isLoggedOut: (req, res, next) => {
        if (req.session.user) {
            res.redirect('/projects')
        } else {
            next();
        }
    }
}