var express = require("express");
var router = express.Router();
const { isLoggedIn } = require("../helpers/util");
const bcrypt = require('bcrypt');
const saltRounds = 8;

module.exports = pool => {
  /* GET users listing. */
  router.get("/", isLoggedIn, (req, res, next) => {
    const {
      checkuserid,
      userid,
      checkuseremail,
      email,
      checkfullname,
      fullname,
      checkuserrole,
      userrole,
      checkusertypejob,
      typejob
    } = req.query;

    let arr = [];
    let page = req.query.page || 1;
    let limit = 3;
    let offset = (page - 1) * limit;
    let url = req.originalUrl;
    if (!url.includes("page")) {
      url = url.includes("?")
        ? url.replace("?", `?page=${page}&`)
        : `${url}?page=${page}`;
    }

    if (checkuserid && userid) {
      arr.push(`userid=${userid}`);
    }
    if (checkuseremail && email) {
      arr.push(`LOWER(email) LIKE '%${email.toLowerCase()}%'`);
    }
    if (checkfullname && fullname) {
      arr.push(`LOWER(CONCAT(users.firstname,' ',users.lastname)) 
      LIKE '%${fullname.toLowerCase()}%'`);
    }
    if (checkuserrole && userrole) {
      arr.push(`role='${userrole}'`);
    }
    if (checkusertypejob && typejob) {
      arr.push(`typejob=${typejob}`);
    }

    let sqlgetuser = `SELECT COUNT(users.userid) total, userid, email, CONCAT(users.firstname,' ',users.lastname) fullname, role, typejob FROM users`;

    if (arr.length > 0) {
      sqlgetuser += ` WHERE ${arr.join(` AND `)}`;
    }

    sqlgetuser += ` GROUP BY userid`;

    pool.query(sqlgetuser, (err, result) => {
      if (err) res.send(err);
      let total = result.rows.length;
      let pages = Math.ceil(total / limit);

      // =============== SQL GET TABLE & PAGINATION ============ \\
      let sqltable = `SELECT users.userid, email, 
      CONCAT(users.firstname,' ',users.lastname) fullname, role, typejob 
      FROM users`;

      if (arr.length > 0) {
        sqltable += ` WHERE ${arr.join(" AND ")}`;
      }

      // ============== SQL PAGINATION =============== \\
      sqltable += ` GROUP BY userid ORDER BY userid LIMIT ${limit} OFFSET ${offset}`;

      // =============== SQL GET OPTION ============ \\
      let sqloption = `SELECT useropt FROM users WHERE userid=${req.session.user.userid}`;

      // ============ IS ADMIN ============== \\
      let sqlAdmin = `SELECT isadmin FROM users WHERE userid=${req.session.user.userid}`;

      const getTable = pool.query(sqltable);
      const getOption = pool.query(sqloption);
      const getadmin = pool.query(sqlAdmin);

      // ========== PROMISE ALL =========== \\
      Promise.all([getTable, getOption, getadmin])
        .then(results => {
          let data = results[0].rows;
          let dataOption = results[1].rows;
          let dataadmin = results[2].rows;
          let isAdmin = dataadmin[0].isadmin;
          let fullname = data.map(x => x.fullname);
          let elemenrole = data.map(y => y.role);
          let elementypejob = data.map(z => z.typejob);
          let option = dataOption[0].useropt;

          res.render("users/list", {
            path: "/users",
            data,
            query: req.query,
            pages,
            page,
            url,
            fullname,
            option,
            elemenrole,
            elementypejob,
            berhasil: req.flash("berhasil")[0],
            isAdmin
          });
        })
        .catch(err => res.send(err));
    });
  });

  // =============== OPTION POST USERS ============== \\
  router.post("/", isLoggedIn, (req, res, next) => {
    let saveKey = Object.keys(req.body);
    let simpanObjek = {
      userid: saveKey.includes("userid"),
      email: saveKey.includes("email"),
      fullname: saveKey.includes("fullname"),
      role: saveKey.includes("role"),
      typejob: saveKey.includes("typejob")
    };

    let sqlopt = `UPDATE users SET useropt='${JSON.stringify(
      simpanObjek
    )}' WHERE userid=${req.session.user.userid}`;

    pool.query(sqlopt, err => {
      if (err) res.send(err);
      req.session.user.useropt = simpanObjek;
      req.flash("berhasil", "Columns Updated!");
      res.redirect("/users");
    });
  });

  // =============== GET ADD DATA USERS ============== \\
  router.get("/add", isLoggedIn, (req, res, next) => {
    let sqlgetadd = `SELECT MAX(userid) total, users.userid, email, 
    CONCAT(users.firstname,' ',users.lastname) fullname, role, typejob 
    FROM users GROUP BY userid`;

    pool.query(sqlgetadd, (err, result) => {
      if (err) res.send(err);
      res.render("users/add", {
        path: "/users",
        isAdmin: req.session.user.isadmin
      });
    });
  });

  // =============== POST ADD DATA USERS ============== \\
  router.post("/add", isLoggedIn, (req, res, next) => {
    let { firstname, lastname, email, password, role, typejob } = req.body;
    let sqladd = `INSERT INTO users(firstname, lastname, email, role`;
    let sqlvalue = ` VALUES('${firstname}','${lastname}','${email}','${role}'`;
    bcrypt.hash(password, saltRounds, (err, hash) => {
      sqladd += `,password`
      sqlvalue += `,'${hash}'`
      if (Boolean(typejob) != undefined) {
        sqladd += `,typejob)`;
        sqlvalue += `, ${Boolean(typejob)})`;
      } else {
        sqladd += `)`;
        sqlvalue += `)`;
      }
      let sql = sqladd + sqlvalue;
      pool.query(sql, err => {
        if (err) throw err;
        req.flash("berhasil", "DUARR!, Success Added New User");
        res.redirect("/users");
      });
    });
  })


  // =============== GET EDIT DATA USERS ============== \\
  router.get("/edit/:id", isLoggedIn, (req, res, next) => {
    let userid = req.params.id;
    let sql = `SELECT users.userid, email, 
    firstname,lastname,password ,role, typejob 
    FROM users WHERE userid=${userid} GROUP BY userid ORDER BY userid`;
    // ============= PROMISE ============ \\
    pool
      .query(sql)
      .then(item => {
        res.render("users/edit", {
          path: "/users",
          item: item.rows[0],
          isAdmin: req.session.user.isadmin
        });
      })
      .catch(err => {
        throw err;
      });
  });

  // =============== GET POST DATA USERS ============== \\

  router.post("/edit/:id", isLoggedIn, (req, res, next) => {
    let userid = req.params.id;
    let { firstname, lastname, email, password, role, typejob } = req.body;
    let result = [];
    let check = false;
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (firstname) {
        check = true;
        result.push(`firstname='${firstname}'`);
      }
      if (lastname) {
        check = true;
        result.push(`lastname='${lastname}'`);
      }
      if (email) {
        check = true;
        result.push(`email='${email}'`);
      }
      if (password) {
        check = true;
        result.push(`password='${hash}'`);
      }
      if (role) {
        check = true;
        result.push(`role='${role}'`);
      }
      if (Boolean(typejob) != undefined) {
        check = true;
        result.push(`typejob='${Boolean(typejob)}'`);
      }
      let sqledit = `UPDATE users `;
      if (check) {
        sqledit += `SET ${result.join(", ")} WHERE userid=${userid}`;
      }
      pool.query(sqledit).then(response => {
        req.flash("berhasil", "DUARR!!, Edited User Success");
        res.redirect("/users");
      })
        .catch(err => {
          throw err;
        });
    });
  })


  router.get("/delete/:id", isLoggedIn, (req, res, next) => {
    let userid = req.params.id;
    let sqldel = `DELETE FROM users WHERE userid=${userid}`;
    pool
      .query(sqldel)
      .then(result => {
        res.redirect("/users");
      })
      .catch(err => console.log(err));
  });

  return router;
};
