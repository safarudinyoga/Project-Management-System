var express = require("express");
var router = express.Router();
var { isLoggedIn } = require("../helpers/util");

module.exports = pool => {
  // ============== GET PROFIL USER LISTING ===============//
  router.get("/", isLoggedIn, (req, res, next) => {
    let sql = `SELECT * FROM users WHERE userid=$1`;
    pool.query(sql, [req.session.user.userid], (err, data) => {
      if (err) throw err;
      let isAdmin = data.rows[0].isadmin;
      res.render("profile/view", {
        title: "Profile",
        data: data.rows[0],
        path: "/profile",
        isAdmin
      });
    });
  });

  // ============== GET UPDATE PROFILE LISTING ===============//
  router.post("/", isLoggedIn, (req, res) => {
    const { userid } = req.session.user;
    let result = [];
    let check = false;
    let { password, role, typejob } = req.body;
    if (password) {
      result.push(`password='${password}'`);
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
      sql += `SET ${result.join(", ")} WHERE userid=$1`;
    }

    pool.query(sql, [req.session.user.userid], (err, response) => {
      req.flash("berhasil", `DUAR!, Profile User #${userid} Has Been Updated!`);
      res.redirect("/projects");
    });
  });
  return router;
}; 
