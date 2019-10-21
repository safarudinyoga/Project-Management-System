var express = require('express');
var router = express.Router();
const moment = require('moment');
const bodyParser = require('body-parser');
var { isLoggedOut , isLoggedIn } = require('../helpers/util');
moment().format();

// parse application/x-www-form-urlencoded
router.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
router.use(bodyParser.json())

module.exports = (pool) => {

  // // GET home page. //

  router.get('/', isLoggedOut, (req, res, next) => {
    //console.log(req.session.user);
    //console.log(req.session.latestUrl);
    res.render('login', { 
      title: 'Login', 
      latestUrl: req.session.latestUrl,
      error: req.flash('error')[0],
      // isAdmin: req.session.user.isadmin
    });

  });

  router.post('/login', (req, res, next) => {
    let sql = `SELECT * FROM users WHERE email=$1 AND password=$2`;
    //console.log(sql);
    let { email, password, latestUrl } = req.body;
    //console.log(latestUrl);
    //console.log(email, password);
    //let { user } = req.session;
    pool.query(sql, [email, password], (err, row) => {
      if (err) throw err;
      console.log(row.rows[0]);
      // console.log(row.rows[0].email);
      // console.log(row.rows[0].password);
      if (row.rows[0]) {
        let isEmail = row.rows[0].email
        let isPassword = row.rows[0].password
        if (email == isEmail && password == isPassword){
          req.session.user = row.rows[0];
          latestUrl = latestUrl || '/projects';
          res.redirect(latestUrl);
        }
      } else {
        req.flash('error', 'Username or Password is Wrong')
        res.redirect('/')
      }
      // if (row == undefined || row.rows.length == 0){
      //   res.redirect('/login')
      // } else {
      //   //console.log(req.session);
      //   req.session.user = row.rows[0];
      //   latestUrl = latestUrl || '/projects';
      //   req.flash('error', 'Username or Password is Wrong')
      //   res.redirect(latestUrl);
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