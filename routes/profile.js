var express = require("express");
var router = express.Router();
var { isLoggedIn } = require("../helpers/util");
const bcrypt = require('bcrypt');
const saltRounds = 8;

module.exports = pool => {
  // ============== GET PROFIL USER LISTING ===============//
  router.get("/", isLoggedIn, (req, res, next) => {
    let sql = `SELECT * FROM users WHERE userid=$1`;
    pool.query(sql, [req.session.user.userid], (err, item) => {
      if (err) throw err;
      // let isAdmin = item.rows[0].isadmin;
      let data = item.rows[0]
      res.render("profile/view", {
        data,
        path: "/profile",
        isAdmin: req.session.user.isadmin
      });
    });
  });

  // ============== GET UPDATE PROFILE LISTING ===============//
  router.post("/", isLoggedIn, (req, res) => {
    const { userid, isadmin } = req.session.user;
    let result = [];
    let check = false;
    let { password, role, typejob } = req.body;
    // console.log(!isadmin);
    bcrypt.hash(password, saltRounds, function (err, hash) {
      if (password) {
        if (!isadmin) {
          check = true;
          result.push(`password='${hash}'`);
        }
      }
      if (role) {
        check = true;
        result.push(`role='${role}'`);
      }
      if (Boolean(typejob) != undefined) {
        check = true;
        result.push(`typejob='${Boolean(typejob)}'`);
      }
      let sql = `UPDATE users `;
      if (check) {
        sql += `SET ${result.join(", ")} WHERE userid=${userid}`;
      }
      // console.log(sql);
      pool.query(sql, (err, response) => {
        req.flash("berhasil", `DUAR!, Profile User #${userid} Has Been Updated!`);
        res.redirect("/projects");
      });
    });
  });
  return router;
};