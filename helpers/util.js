module.exports = {
  isLoggedIn: (req, res, next) => {
    if (req.session.user) {
      next();
    } else {
      req.session.latestUrl = req.originalUrl;
      res.redirect("/");
    }
  },

  isLoggedOut: (req, res, next) => {
    if (req.session.user) {
      res.redirect("/projects");
    } else {
      next();
    }
  }
};
