var express = require('express');
var router = express.Router();
var { isLogged } = require('../helpers/util');

module.exports = (pool) => {
/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

return router;
}