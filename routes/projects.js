var express = require('express');
var router = express.Router();
const moment = require('moment');
const { isLogged } = require('../helpers/util');
moment().format();

module.exports = (pool) => {
    router.get('/', isLogged, (req, res, next) => {
        res.render('projects/list', { title: 'Projects'});
    })
    return router;
}