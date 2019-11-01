var express = require('express');
var router = express.Router();
const moment = require('moment');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
var { isLoggedOut, isLoggedIn } = require('../helpers/util');
moment().format();

// parse application/x-www-form-urlencoded
router.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
router.use(bodyParser.json())

module.exports = (pool) => {

  // // GET home page. //

  router.get('/', isLoggedOut, (req, res, next) => {
    res.render('login', {
      title: 'Login',
      latestUrl: req.session.latestUrl,
      error: req.flash('error')[0]
    });

  });

  router.post('/login', (req, res, next) => {
    let { email, password, latestUrl } = req.body;
    let sql = `SELECT * FROM users WHERE email='${email}'`;
    pool.query(sql, (err, row) => {
      if (err) throw err;
      // console.log(row.rows[0]);
      // let isEmail = row.rows[0].email
      let isPassword = row.rows[0].password
      // console.log(isPassword);
      bcrypt.compare(password, isPassword, (err, valid) => {
        // console.log(password == isPassword);
        // console.log(valid);
        if (valid || password == isPassword) {
          req.session.user = row.rows[0];
          latestUrl = latestUrl || '/projects';
          res.redirect(latestUrl);
        } else {
          req.flash('error', 'Username or Password is Wrong')
          res.redirect('/')
        }
      });
      // if (row.rows[0]) {
      //   let isEmail = row.rows[0].email
      //   let isPassword = row.rows[0].password
      //   if (email == isEmail && password == isPassword) {
      //     req.session.user = row.rows[0];
      //     latestUrl = latestUrl || '/projects';
      //     res.redirect(latestUrl);
      //   }
      // } else {
      //   req.flash('error', 'Username or Password is Wrong')
      //   res.redirect('/')
      // }
    })
  });

  // ================ LOGOUT PAGE ================= \\
  router.get('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) throw err;
      res.redirect('/');
    })
  })

  return router;
}