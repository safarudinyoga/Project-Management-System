var express = require('express');
var router = express.Router();
const { isLoggedIn } = require('../helpers/util');

module.exports = (pool) => {
  /* GET users listing. */
  router.get('/', isLoggedIn, (req, res, next) => {

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
      typejob,
    } = req.query;

    let arr = [];
    let page = req.query.page || 1;
    let limit = 3;
    let offset = (page - 1) * limit;
    let url = (req.url == '/') ? '/?page=1' : req.url;

    if (checkuserid && userid) {
      arr.push(`userid=${userid}`)
    }
    if (checkuseremail && email) {
      arr.push(`LOWER(email) LIKE '%${email.toLowerCase()}%'`)
    }
    if (checkfullname && fullname) {
      arr.push(`LOWER(CONCAT(users.firstname,' ',users.lastname)) 
      LIKE '%${fullname.toLowerCase()}%'`)
    }
    if (checkuserrole && userrole) {
      arr.push(`role='${userrole}'`)
    }
    if (checkusertypejob && typejob) {
      arr.push(`typejob=${typejob}`)
    }

    let sqlgetuser = `SELECT COUNT(users.userid) total, userid, email, CONCAT(users.firstname,' ',users.lastname) fullname, role, typejob FROM users`;

    if (arr.length > 0) {
      sqlgetuser += ` WHERE ${arr.join(` AND `)}`;
    }

    sqlgetuser += ` GROUP BY userid`;
    //console.log(sqlgetuser);

    pool.query(sqlgetuser, (err, result) => {
      if (err) res.send(err);
      let total = result.rows.length;
      //console.log(total);
      let pages = Math.ceil(total / limit)

      // =============== SQL GET TABLE & PAGINATION ============ \\
      let sqltable = `SELECT users.userid, email, 
      CONCAT(users.firstname,' ',users.lastname) fullname, role, typejob 
      FROM users`;

      if (arr.length > 0) {
        sqltable += ` WHERE ${arr.join(' AND ')}`;
      }

      // ============== SQL PAGINATION =============== \\
      sqltable += ` GROUP BY userid ORDER BY userid LIMIT ${limit} OFFSET ${offset}`;

      // =============== SQL GET OPTION ============ \\
      let sqloption = `SELECT useropt FROM users WHERE userid=${req.session.user.userid}`

      const getTable = pool.query(sqltable);
      const getOption = pool.query(sqloption);

      // ========== PROMISE ALL =========== \\
      Promise.all([getTable, getOption]).then(results => {
        const data = results[0].rows;
        console.log(data);
        const dataOption = results[1].rows;
        let fullname = data.map(x => x.fullname);
        let elemenrole = data.map(y => y.role)
        // let elemenuserid = data.map(a => a.userid)
        let elementypejob = data.map(z => z.typejob)
        let option = dataOption[0].useropt

        // console.log('fullname', fullname);
        // console.log('elemenrole', elemenrole);
        // console.log('elementypejob', elementypejob);
        // console.log('option', option);
        // console.log('elemenuserid>', elemenuserid);
        res.render('users/list', {
          path: "/users",
          data,
          query: req.query,
          pages,
          page,
          url,
          fullname,
          option,
          elemenrole,
          elementypejob
        });
      })
        .catch(err => res.send(err));
    })
  });

  // =============== OPTION POST USERS ============== \\
  router.post('/', isLoggedIn, (req, res, next) => {

    let saveKey = Object.keys(req.body);
    let simpanObjek = {
      userid: saveKey.includes('userid'),
      email: saveKey.includes('email'),
      fullname: saveKey.includes('fullname'),
      role: saveKey.includes('role'),
      typejob: saveKey.includes('typejob')
    }

    let sqlopt = `UPDATE users SET useropt='${JSON.stringify(simpanObjek)}' WHERE userid=${req.session.user.userid}`;

    pool.query(sqlopt, (err) => {
      if (err) res.send(err);
      req.session.user.useropt = simpanObjek;
      //console.log(req.session.user.useropt)
      res.redirect('/users')
    })
  })

  // =============== GET ADD DATA USERS ============== \\
  router.get('/add', isLoggedIn, (req, res, next) => {

    let sqlgetadd = `SELECT MAX(userid) total, users.userid, email, 
    CONCAT(users.firstname,' ',users.lastname) fullname, role, typejob 
    FROM users GROUP BY userid`

    pool.query(sqlgetadd, (err, result) => {
      if (err) res.send(err);
      // const usernextvalue = result.rows[0].total
      //console.log(usernextvalue);
      // const flname = result.rows.map(x => x.fullname);
      // const elemen = result.rows.map(y => y.userid);
      res.render('users/add', {
        // flname, 
        // elemen, 
        path: "/users"
      });
    })
  })

  // =============== POST ADD DATA USERS ============== \\
  router.post('/add', isLoggedIn, (req, res, next) => {

    let { firstname, lastname, email, password, role, typejob } = req.body;
    //let insert = [firstname, lastname, email, password, role, typejob];
    let sqladd = `INSERT INTO users(firstname, lastname, email, password, role`
    let sqlvalue = ` VALUES('${firstname}','${lastname}','${email}','${password}','${role}'`
    let arr = [];
    if (Boolean(typejob) != undefined) {
      // arr.push(`'${Boolean(typejob)}'`)
      sqladd += `,typejob)`
      sqlvalue += `, ${Boolean(typejob)})`
    } else {
      sqladd += `)`
      sqlvalue += `)`
    }
    console.log(sqladd);
    let sql = sqladd + sqlvalue
    pool.query(sql, (err) => {
      if (err) throw (err);
      res.redirect('/users');
    })
  })

  // =============== GET EDIT DATA USERS ============== \\
  router.get('/edit/:id', isLoggedIn, (req, res, next) => {

    let userid = req.params.id;
    let sql = `SELECT users.userid, email, 
    firstname,lastname,password ,role, typejob 
    FROM users WHERE userid=${userid} GROUP BY userid ORDER BY userid`
    // ============= PROMISE ============ \\
    pool.query(sql).then(item => {
      console.log(item.rows)
      
      // let userdata = item.rows
      // let sqledit = `SELECT users.userid, email, 
      // firstname,lastname,password ,role, typejob 
      // FROM users GROUP BY userid ORDER BY userid`  
      res.render('users/edit', {
        path: '/users',
        item: item.rows[0],
      })
    }).catch(err => {
      throw err;
    })

    // pool.query(sql, (err, result) => {
    //   if (err) throw err;
    //   console.log(res.rows);
    //   res.render('users/edit', {
    //     path: '/users'
    //   })
    // })
  })

  // =============== GET POST DATA USERS ============== \\

  router.post('/edit/:id', isLoggedIn, (req, res, next) => {

    let userid = req.params.id;
    let { firstname, lastname, email, password, role, typejob } = req.body;
    let result = [];
    let check = false;
    if (firstname) {
      check = true;
      result.push(`firstname='${firstname}'`)
    }
    if (lastname) {
      check = true;
      result.push(`lastname='${lastname}'`)
    }
    if (email) {
      check = true;
      result.push(`email='${email}'`)
    }
    if (password) {
      check = true;
      result.push(`password='${password}'`)
    }
    if (role) {
      check = true;
      result.push(`role='${role}'`)
    }
    if (Boolean(typejob) != undefined) {
      check = true;
      result.push(`typejob='${Boolean(typejob)}'`)
    }
    let sqledit = `UPDATE users `;
    if (check) {
      sqledit += `SET ${result.join(', ')} WHERE userid=${userid}`
    }
    console.log(sqledit);

    pool.query(sqledit).then(response => {
      res.redirect('/users');
      console.log(firstname,lastname,email,password,role,typejob);
    }).catch(err => {
      throw err;
    })
  })

  router.get('/delete/:id', isLoggedIn, (req, res, next) => {

    let userid = req.params.id;
    let sqldel = `DELETE FROM users WHERE userid=${userid}`;
    pool.query(sqldel).then(result => res.redirect('/users')).catch(err => console.log(err));
  })

  return router;
}
