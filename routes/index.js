var express = require('express');
var router = express.Router();
const moment = require('moment');
const bodyParser = require('body-parser');
var { isLogged } = require('../helpers/util');
moment().format();

// parse application/x-www-form-urlencoded
router.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
router.use(bodyParser.json())

module.exports = (pool) => {

  // // GET home page. //
  router.get('/', (req, res, next) => {
    res.render('login', { title: 'Login'});
  });

  router.get('/login', (req, res, next) => {
    res.render('login', { title: 'Login', user: req.session.user });
  });

  router.post('/login', (req, res, next) => {
    let sql = `SELECT * FROM users WHERE email=$1 AND password=$2`;
    console.log(sql);
    let { email, password } = req.body;
    console.log(email, password);
    //let { user } = req.session;
    pool.query(sql, [email, password], (err, row) => {
      if (err) throw err;
      console.log(row.rows[0]);
      if (row == undefined || row.rows.length == 0){
        res.redirect('login')
      } else {
        console.log(req.session);
        req.session.user = row.rows[0];
        console.log(req.session.user);
        res.redirect('/projects')
      }
    })
  });

  // ================ LOGOUT PAGE ================= \\
  router.get('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) throw err;
      res.redirect('/login');
    })
  })

  return router;
}