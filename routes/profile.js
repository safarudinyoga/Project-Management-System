var express = require('express');
var router = express.Router();
var { isLoggedIn } = require('../helpers/util');

module.exports = (pool) => {
  // ============== GET PROFIL USER LISTING ===============//
  router.get('/', isLoggedIn,(req, res, next) => {
    let sql = `SELECT * FROM users WHERE userid=$1`
    //console.log(req.session.user);
    //console.log(userid);
    pool.query(sql, [req.session.user.userid], (err, data) => {
      if (err) throw err;
      //console.log(req.session.user.userid);
      console.log(data.rows[0]);
      res.render('profile/view', { title: 'Profile', data: data.rows[0], path:"/profile"})
    })
  });

  // ============== GET UPDATE PROFILE LISTING ===============//
  router.post('/', isLoggedIn, (req, res) => {
    let result = [];
    let check = false
    let {password, role, typejob} = req.body;
    if (password){
      result.push(`password='${password}'`);
    } 
    if (role){
      check = true;
      result.push(`role='${role}'`);
    } 
    if (Boolean(typejob) != undefined){
      check = true;
      result.push(`typejob='${Boolean(typejob)}'`)
    }
    let sql =  `UPDATE users `;
    if (check) {
      sql += `SET ${result.join(", ")} WHERE userid=$1`;
    }
    console.log(sql);
    pool.query(sql, [req.session.user.userid], (err, response) => {
      res.redirect('/projects');
    })
    console.log(password);
    console.log(role);
    console.log(typejob);
  });

  return router;
}
