var express = require('express');
var router = express.Router();
var { isLogged } = require('../helpers/util');

module.exports = (pool) => {
/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('users/list', { path: "/users" });
});

return router;
}
