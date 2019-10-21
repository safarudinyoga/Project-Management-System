var express = require("express");
var router = express.Router();
const moment = require("moment");
const path = require("path");
const { isLoggedIn } = require("../helpers/util");
moment().format();

module.exports = pool => {
  // =============== GET DATA & FILTER =============== \\
  router.get("/", isLoggedIn, (req, res, next) => {
    // ============ SQL UNTUK MENAMPILKAN BANYAK MEMBER ========== \\
    // let sql = `SELECT members.projectid, MAX(projects.name) projectname, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid) GROUP BY projectid ORDER BY projectid`

    // ============ SQL CONCAT MEMBER ========== \\
    // let sql = `SELECT projects.projectid, projects.name, users.userid, CONCAT (users.firstname,' ',users.lastname) AS members FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid ORDER BY projectid`

    const {
      checkid,
      projectid,
      checkname,
      projectname,
      checkmember,
      member
    } = req.query;

    // =================== SQL MULTIPLE MEMBER ON FILTER =============== \\
    const subsubquery = `SELECT projectid FROM members WHERE userid=${member}`;
    const subquery = `SELECT userid FROM members WHERE projectid IN (${subsubquery})`;

    let arr = [];
    let page = req.query.page || 1;
    let limit = 5;
    let offset = (page - 1) * limit;
    let url = req.originalUrl;
    if (!url.includes("page")) {
      url = url.includes("?")
        ? url.replace("?", `?page=${page}&`)
        : `${url}?page=${page}`;
    }

    if (checkid && projectid) {
      arr.push(`projectid=${projectid}`);
    }
    if (checkname && projectname) {
      arr.push(`LOWER(name) LIKE '%${projectname.toLowerCase()}%'`);
    }
    if (checkmember && member) {
      arr.push(
        `users.userid IN ( ${subquery} ) AND projects.projectid IN ( ${subsubquery} )`
      );
    }

    // ============ SQL UNTUK MENAMPILKAN FILTER ========== \\
    let sqlfilter = `SELECT COUNT(members.projectid) total, ARRAY_AGG(userid) member, projectid, MAX(projects.name) projectname, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid)`;

    // let sql1 = `SELECT DISTINCT projects.projectid, projects.name, users.firstname, users.userid FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid`

    if (arr.length > 0) {
      sqlfilter += ` WHERE ${arr.join(" AND ")}`;
    }
    sqlfilter += ` GROUP BY projectid ORDER BY projectid`;

    pool.query(sqlfilter, (err, result) => {
      if (err) throw err;
      let total = result.rows.length;
      let pages = Math.ceil(total / limit);

      // ================= METHOD REDUCE ============= \\
      //let total = result.rows.map(x => Number(x.total)).reduce((total, el) => total + el, 0);

      // ================= SQL UNTUK MENAMPILKAN TABLE DATA PROJECTS ============== \\
      let sql = `SELECT members.projectid, MAX(projects.name) projectname, ARRAY_AGG(userid) member, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid)`;

      if (arr.length > 0) {
        sql += ` WHERE ${arr.join(" AND ")}`;
      }

      // ================= SQL UNTUK PAGINATION ============== \\
      sql += ` GROUP BY projectid ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`;

      // ================ SQL UNTUK MENAMPILKAN SEMUA MEMBER DI FILTER =========== \\
      let sqluser = `SELECT users.userid, 
            CONCAT(users.firstname,' ',users.lastname) fullname 
            FROM users GROUP BY userid`;

      // ======= sql option ======== \\
      let sqloption = `SELECT projectopt FROM users WHERE userid = ${req.session.user.userid}`;

      // ======= SQL IS ADMIN ======== \\
      let sqlAdmin = `SELECT isadmin FROM users WHERE userid=${req.session.user.userid}`;

      const getTable = pool.query(sql);
      const getUsers = pool.query(sqluser);
      const getOption = pool.query(sqloption);
      const getadmin = pool.query(sqlAdmin);

      // =========== PROMISE UNTUK MENRENDER SQL DENGAN TUJUAN YG BERBEDA ======= \\
      Promise.all([getTable, getUsers, getOption, getadmin])
        .then(results => {
          const data = results[0].rows;
          const dataUsers = results[1].rows;
          const dataOption = results[2].rows;
          const dataadmin = results[3].rows;
          let isAdmin = dataadmin[0].isadmin;
          let flname = dataUsers.map(x => x.fullname);
          let elemen = dataUsers.map(y => y.userid);
          res.render("projects/list", {
            title: "Projects",
            data,
            path: "/projects",
            query: req.query,
            pages,
            page,
            url,
            isAdmin,
            flname,
            elemen,
            option: dataOption[0].projectopt,
            berhasil: req.flash("berhasil")[0]
          });
        })
        .catch(err => console.error(err)); //CATCH HARUS DI DEFINISI
    });
  });

  // =============== UPDATE OPTION DATA PROJECT =============== \\
  router.post("/", isLoggedIn, (req, res, next) => {
    let saveKey = Object.keys(req.body);
    let simpanObjek = {
      projectid: saveKey.includes("projectid"),
      projectname: saveKey.includes("projectname"),
      members: saveKey.includes("members")
    };

    // ========= SQL TANPA QUERY BINDING '[]' DI POOL.QUERY ======== \\
    // let sqlopt = `UPDATE users SET projectopt='${JSON.stringify(simpanObjek)}' WHERE userid=${req.session.user.userid}`;

    let sqlopt = `UPDATE users SET projectopt=$1 WHERE userid=${req.session.user.userid}`;

    pool.query(sqlopt, [simpanObjek], (err, item) => {
      if (err) throw err;
      req.session.user.projectopt = simpanObjek;
      req.flash("berhasil", "Updated Options!");
      res.redirect("/projects");
    });
  });

  // =============== ADD DATA PROJECT =============== \\
  router.get("/add", isLoggedIn, (req, res, next) => {
    // ================ QUERY BUAT MENAMPILKAN ARRAY_AGG & STRING_AGG =============== \\
    // let sqlgetadd = `SELECT ARRAY_AGG(userid) member, STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname FROM members INNER JOIN users USING (userid) INNER JOIN projects USING (projectid) GROUP BY projectid ORDER BY projectid`

    let sqlgetadd = `SELECT users.userid, isadmin,
        STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname 
        FROM users GROUP BY userid`;

    // ============ IS ADMIN ============== \\
    let sqlAdmin = `SELECT isadmin FROM users WHERE userid=${req.session.user.userid}`;

    Promise.all([pool.query(sqlgetadd), pool.query(sqlAdmin)])
      .then(results => {
        let getadd = results[0].rows;
        let dataadmin = results[1].rows;
        const flname = getadd.map(x => x.fullname);
        const elemen = getadd.map(y => y.userid);
        let isAdmin = dataadmin[0].isadmin;
        res.render("projects/add", {
          title: "Add Project",
          flname,
          elemen,
          isAdmin,
          path: "/projects"
        });
      })
      .catch(err => console.log(err));
  });

  //=========HOW TO SEQUENCE(INDEX) BACK TO RESTART=======\\
  //ALTER SEQUENCE projects_projectid_seq RESTART WITH 3\\

  router.post("/add", isLoggedIn, (req, res, next) => {
    let sql = `INSERT INTO projects(name) VALUES ('${req.body.addpjname}')`;

    pool.query(sql, err => {
      let sqlnext = `SELECT MAX(projectid) total FROM projects`;
      pool.query(sqlnext, (err, result) => {
        if (err) return res.send(err);
        let temp = [];
        const projectId = result.rows[0].total;
        if (typeof req.body.member == "string") {
          temp.push(`(${req.body.member}, ${projectId})`);
        } else {
          for (let i = 0; i < req.body.member.length; i++) {
            temp.push(`(${req.body.member[i]}, ${projectId})`);
          }
        }
        let sqladd = `INSERT INTO members (userid, projectid) VALUES ${temp.join(
          ", "
        )}`;

        pool.query(sqladd, err => {
          if (err) res.send(err);
          req.flash("berhasil", "DUAR!, Success Added New Projects");
          res.redirect("/projects");
        });
      });
    });
  });

  // =============== EDIT DATA =============== \\
  router.get("/edit/:id", isLoggedIn, (req, res, next) => {
    let sqledit = `SELECT users.userid, concat(users.firstname,' ', users.lastname) as fullname FROM users ORDER BY userid`;

    pool.query(sqledit, (err, result) => {
      const userdata = result.rows;
      let projectid = req.params.id;

      let sqlgetedit = `SELECT members.projectid, MAX(projects.name) nama, ARRAY_AGG(userid) member, 
            STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname 
            FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid) 
            WHERE projectid=${projectid} GROUP BY projectid ORDER BY projectid`;

      // ============ IS ADMIN ============== \\
      let sqlAdmin = `SELECT isadmin FROM users WHERE userid=${req.session.user.userid}`;

      Promise.all([pool.query(sqlgetedit), pool.query(sqlAdmin)])
        .then(results => {
          let dataedit = results[0].rows;
          let dataadmin = results[1].rows;
          let elemenedit = dataedit.map(x => x.member);
          let isAdmin = dataadmin[0].isadmin;
          let item = dataedit[0];
          res.render("projects/edit", {
            elemenedit,
            userdata,
            isAdmin,
            item,
            path: "/projects"
          });
        })
        .catch(err => console.log(err));
    });
  });

  router.post("/edit/:id", isLoggedIn, (req, res, next) => {
    let projectid = req.params.id;
    let sqlpostedit = `UPDATE projects SET name='${req.body.name}' WHERE projectid=${projectid}`;
    pool.query(sqlpostedit, err => {
      if (err) throw err;
      let sqldeletemembertemp = `DELETE FROM members WHERE projectid = ${projectid}`;
      pool.query(sqldeletemembertemp, err => {
        let temp = [];
        if (typeof req.body.member == "string") {
          temp.push(`(${req.body.member}, ${projectid})`);
        } else {
          for (let i = 0; i < req.body.member.length; i++) {
            temp.push(`(${req.body.member[i]}, ${projectid})`);
          }
        }
        let sql = `INSERT INTO members (userid, projectid) VALUES ${temp.join(
          ", "
        )}`;
        pool.query(sql, err => {
          if (err) res.send(err);
          req.flash("berhasil", `DUARRR!! Edit Project #${projectid} Success!`);
          res.redirect("/projects");
        });
      });
    });
  });

  // =============== DELETE DATA =============== \\

  router.get("/delete/:id", isLoggedIn, (req, res, next) => {
    let projectid = req.params.id;

    let sqldelete = `DELETE FROM members WHERE projectid=${projectid}`;

    // ============ IS ADMIN ============== \\
    let sqlAdmin = `SELECT isadmin FROM users WHERE userid=${req.session.user.userid}`;

    Promise.all([pool.query(sqldelete), pool.query(sqlAdmin)])
      .then(results => {
        let dataadmin = results[1].rows;
        let isAdmin = dataadmin[0].isadmin;
        res.redirect("/projects");
      })
      .catch(err => console.log(err));
  });

  // ========== ROUTER OVERVIEW, MEMBER, ACTIVITY, ISSUES ============//

  // ================== GET OVERVIEW =============== \\

  router.get("/overview/:projectid", isLoggedIn, (req, res, next) => {
    let projectid = req.params.projectid;

    // ========== SQL LIST MEMBER YG ADA DI PROJECT ========= \\
    let sqlmember = `SELECT members.projectid, MAX(projects.name) projectname, 
        STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') 
        fullname FROM members INNER JOIN projects USING (projectid) 
        INNER JOIN users USING (userid) GROUP BY projectid ORDER BY projectid`;

    let sqltotalbug = `SELECT issues.tracker,
        COUNT(CASE WHEN tracker = 'Bug' THEN '' END) totalbug,
        COUNT(CASE WHEN tracker = 'Feature' THEN '' END) totalfeature,
        COUNT(CASE WHEN tracker = 'Support' THEN '' END) totalsupport,
        COUNT(CASE WHEN tracker = 'Bug' AND status != 'Closed' THEN '' END) bugopen,
        COUNT(CASE WHEN tracker = 'Feature' AND status != 'Closed' THEN '' END) featureopen,
        COUNT(CASE WHEN tracker = 'Support' AND status != 'Closed' THEN '' END) supportopen
        FROM issues WHERE projectid=${projectid} GROUP BY tracker`;

    Promise.all([pool.query(sqlmember), pool.query(sqltotalbug)])
      .then(results => {
        datamember = results[0].rows;
        dataissues = results[1].rows;

        // GET MEMBER \\
        const namamember = datamember
          .filter(y => y.projectid == projectid)
          .map(x => x.fullname);
        let pjname = datamember
          .filter(y => y.projectid == projectid)
          .map(x => x.projectname);
        let listnama = namamember[0].split(",");

        // ISSUES \\
        let issuesData = [
          {
            tracker: "Bug",
            open: 0,
            total: 0
          },
          {
            tracker: "Feature",
            open: 0,
            total: 0
          },
          {
            tracker: "Support",
            open: 0,
            total: 0
          }
        ];

        let Bug = dataissues.filter(value => value.totalbug > 0);
        let Feature = dataissues.filter(value => value.totalfeature > 0);
        let Support = dataissues.filter(value => value.totalsupport > 0);

        issuesData.forEach(value => {
          if (value.tracker == "Bug" && Bug[0]) {
            value.open = Number(Bug[0].bugopen);
            value.total = Number(Bug[0].totalbug);
          }
          if (value.tracker == "Feature" && Feature[0]) {
            value.open = Number(Feature[0].featureopen);
            value.total = Number(Feature[0].totalfeature);
          }
          if (value.tracker == "Support" && Support[0]) {
            value.open = Number(Support[0].supportopen);
            value.total = Number(Support[0].totalsupport);
          }
        });

        res.render("projects/overview/view", {
          path: "/projects/overview",
          projectid,
          listnama,
          pjname,
          issuesData,
          isAdmin: req.session.user.isadmin
        });
      })
      .catch(err => console.log(err));
  });

  // ================== GET ACTIVITY =============== \\
  router.get("/activity/:projectid", isLoggedIn, (req, res, next) => {
    const { projectid, userid } = req.params;

    // ========== JANGAN LUPA DIGANTI UTC TIMEZONE KANAN GOBLOG ========= \\
    let sqlactivity = `SELECT (time AT TIME ZONE 'Asia/Jakarta' AT TIME ZONE 'asia/jakarta')::DATE datedoang,
        (time AT TIME ZONE 'Asia/Jakarta' AT time zone 'asia/jakarta')::time timedoang,
        title, description, author
        FROM activity WHERE projectid=${projectid}`;

    // ====== QUERY UNTUK DAPAT NAMA PROJECTS ====== \\
    let sqlpjname = `SELECT members.projectid, MAX(projects.name) projectname 
    FROM members INNER JOIN projects USING (projectid) 
    INNER JOIN users USING (userid) WHERE projectid=${projectid} GROUP BY projectid ORDER BY projectid`;

    //  ======== https://github.com/RofiSyahrul/project-management-system/blob/master/controllers/project-activity.js ======= \\
    function convertDateTerm(date) {
      date = moment(date).format("YYYY-MM-DD");
      const today = moment().format("YYYY-MM-DD");
      const yesterday = moment()
        .subtract(1, "days")
        .format("YYYY-MM-DD");
      if (date == today) {
        return "Today";
      } else if (date == yesterday) {
        return "Yesterday";
      }
      return moment(date).format("MMMM Do, YYYY");
    }

    Promise.all([pool.query(sqlpjname), pool.query(sqlactivity)])
      .then(results => {
        let dataproject = results[0].rows;
        let dataactivity = results[1].rows;
        dataactivity = dataactivity.map(x => {
          x.datedoang = moment(x.datedoang).format("YYYY-MM-DD");
          x.timedoang = moment(x.timedoang, "HH:mm:ss.SSS").format("HH:mm:ss");
          return x;
        });

        // TO GET UNIX DATE
        let dateaja = dataactivity.map(x => x.datedoang);
        dateunix = dateaja.filter((date, index, arr) => {
          return arr.indexOf(date) == index;
        });

        let actperdate = dateunix.map(date => {
          let dataInDate = dataactivity.filter(item => item.datedoang == date);
          return {
            date: convertDateTerm(date),
            data: dataInDate
          };
        });

        pjname = dataproject.map(x => x.projectname);
        res.render("projects/activity/view", {
          path: "/projects/activity",
          projectid,
          pjname,
          actperdate,
          isAdmin: req.session.user.isadmin
        });
      })
      .catch(err => console.log(err));
  });

  // ================== GET MEMBERS =============== \\
  router.get("/members/:projectid", isLoggedIn, (req, res, next) => {
    let projectid = req.params.projectid;
    const {
      checkid,
      userid,
      checkname,
      fullname,
      checkroles,
      roles
    } = req.query;

    let arr = [];
    let page = req.query.page || 1;
    let limit = 5;
    let offset = (page - 1) * limit;
    let url = req.originalUrl;
    if (!url.includes("page")) {
      url = url.includes("?")
        ? url.replace("?", `?page=${page}&`)
        : `${url}?page=${page}`;
    }

    if (checkid && userid) {
      arr.push(`userid=${userid}`);
    }
    if (checkname && fullname) {
      arr.push(`LOWER(CONCAT(users.firstname,' ',users.lastname)) 
            LIKE '%${fullname.toLowerCase()}%'`);
    }
    if (checkroles && roles) {
      arr.push(`roles='${roles}'`);
    }

    let sqlcount = `SELECT count(*) as total FROM members INNER JOIN users USING (userid) WHERE members.projectid=${projectid}`;

    if (arr.length > 0) {
      sqlcount += ` AND ${arr.join(" AND ")}`;
    }

    pool.query(sqlcount, (err, result) => {
      if (err) throw err;
      let total = result.rows[0].total; // TOTAL DATA PAGE FROM QUERY
      let pages = Math.ceil(total / limit);

      // =============== SQL TABLE ============== \\
      let sqltable = `SELECT users.userid, 
            CONCAT(users.firstname, ' ', users.lastname) fullname,
            members.roles
            FROM members INNER JOIN users USING (userid)
            WHERE members.projectid=${projectid}`;

      if (arr.length > 0) {
        sqltable += ` AND ${arr.join(" AND ")}`;
      }

      // ============== SQL PAGINATION =============== \\
      sqltable += ` ORDER BY userid LIMIT ${limit} OFFSET ${offset}`;

      let sqloption = `SELECT memberopt FROM users WHERE userid=${req.session.user.userid}`;

      const getTable = pool.query(sqltable);
      const getOption = pool.query(sqloption);

      // ============ PROMISE ALL =========== \\
      Promise.all([getTable, getOption])
        .then(results => {
          const data = results[0].rows;
          let fullname = data.map(x => x.fullname);
          const dataOption = results[1].rows;
          let option = dataOption[0].memberopt;

          res.render("projects/members/list", {
            path: "/projects/members",
            projectid,
            data,
            option,
            pages,
            page,
            url,
            fullname,
            query: req.query,
            berhasil: req.flash("berhasil")[0],
            isAdmin: req.session.user.isadmin
          });
        })
        .catch(err => console.log(err));
    });
  });

  // ================ UPDATE OPTION ================ \\
  router.post("/members/:projectid", isLoggedIn, (req, res, next) => {
    let projectid = req.params.projectid;
    let savekeyoption = Object.keys(req.body);
    let simpanoption = {
      userid: savekeyoption.includes("userid"),
      fullname: savekeyoption.includes("fullname"),
      roles: savekeyoption.includes("roles")
    };

    let sqloption = `UPDATE users SET memberopt='${JSON.stringify(
      simpanoption
    )}' WHERE userid=${req.session.user.userid}`;

    pool
      .query(sqloption)
      .then(result => {
        req.session.user.memberopt = simpanoption;
        req.flash("berhasil", "Options Updated!");
        res.redirect(`${projectid}`);
      })
      .catch(err => console.log(err));
  });

  // =============== ADD MEMBERS ================= \\
  router.get("/members/:projectid/add", isLoggedIn, (req, res, next) => {
    const projectid = req.params.projectid;

    // `SELECT MAX(users.userid) userid, MAX(members.roles) roles,
    // STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname
    // FROM members INNER JOIN users USING (userid) GROUP BY userid`

    // `SELECT * FROM users WHERE userid NOT IN (SELECT users.userid
    //     FROM members INNER JOIN users USING (userid)
    //     WHERE projectid=7) ORDER BY userid`

    // ===== QUERY UNTUK GET MEMBER NOT IN PROJECTS ===== \\
    const subquery = `SELECT users.userid FROM members INNER JOIN users USING (userid) WHERE projectid=${projectid}`;
    let sqlgetadd = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) fullname FROM users WHERE userid NOT IN (${subquery}) ORDER BY userid`;

    // ====== QUERY UNTUK DAPAT NAMA PROJECTS ====== \\
    let sqlpjname = `SELECT members.projectid, MAX(projects.name) projectname 
        FROM members INNER JOIN projects USING (projectid) 
        INNER JOIN users USING (userid) WHERE projectid=${projectid} GROUP BY projectid ORDER BY projectid`;

    const getMember = pool.query(sqlgetadd);
    const getPjname = pool.query(sqlpjname);

    Promise.all([getMember, getPjname])
      .then(results => {
        const data = results[0].rows;
        const datapjname = results[1].rows;
        let datanama = data.map(x => x.fullname);
        let datauserid = data.map(x => x.userid);
        let pjname = datapjname.map(x => x.projectname);
        res.render(`projects/members/add`, {
          path: "/projects/members",
          projectid,
          pjname,
          datanama,
          datauserid,
          isAdmin: req.session.user.isadmin
        });
      })
      .catch(err => console.log(err));
  });

  router.post("/members/:projectid/add", isLoggedIn, (req, res, next) => {
    let projectid = req.params.projectid;
    const { addmember, role } = req.body;

    // ========= PRIMARY SQL ========= \\
    // `SELECT members.projectid,
    // MAX(members.userid) userid, MAX(members.roles) roles
    //         FROM members INNER JOIN projects USING (projectid)
    //         INNER JOIN users USING (userid) WHERE projectid=1
    //         GROUP BY projectid ORDER BY projectid`

    let sqlpostadd = `INSERT INTO members(userid,roles,projectid) VALUES(${addmember}, '${role}', ${projectid})`;

    pool
      .query(sqlpostadd)
      .then(result => {
        req.flash("berhasil", `Success Added Member to Project #${projectid}`);
        res.redirect(`/projects/members/${projectid}`);
      })
      .catch(err => console.log(err));
  });

  router.get(
    "/members/:projectid/edit/:userid",
    isLoggedIn,
    (req, res, next) => {
      let projectid = req.params.projectid;

      // ===== QUERY UNTUK GET MEMBER IN PROJECTS ===== \\
      const sqlgetedit = `SELECT MAX(members.userid) userid, MAX(members.roles) roles,
        STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname 
        FROM members INNER JOIN users USING (userid) 
		WHERE projectid=${projectid} GROUP BY userid ORDER BY userid `;

      // ====== QUERY UNTUK DAPAT NAMA PROJECTS ====== \\
      const sqlpjname = `SELECT members.projectid, MAX(projects.name) projectname 
        FROM members INNER JOIN projects USING (projectid) 
        INNER JOIN users USING (userid) WHERE projectid=${projectid} GROUP BY projectid ORDER BY projectid`;

      const getEdit = pool.query(sqlgetedit);
      const getjudulpj = pool.query(sqlpjname);

      Promise.all([getEdit, getjudulpj]).then(results => {
        const data = results[0].rows;
        const namapj = results[1].rows;
        let pjname = namapj.map(x => x.projectname);
        let datanama = data.map(x => x.fullname);
        let datauserid = data.map(x => x.userid);
        const item = results[0].rows[0];

        res.render("projects/members/edit", {
          path: "/projects/members",
          projectid,
          pjname,
          item,
          isAdmin: req.session.user.isadmin
        });
      });
    }
  );

  router.post(
    "/members/:projectid/edit/:userid",
    isLoggedIn,
    (req, res, next) => {
      const { projectid, userid } = req.params;
      const { roles } = req.body;
      const sqlpostedit = `UPDATE members SET roles='${roles}'
        WHERE projectid=${projectid} AND userid=${userid}`;

      pool
        .query(sqlpostedit)
        .then(result => {
          req.flash("berhasil", `DUARR!, Edit User #${userid} Success`);
          res.redirect(`/projects/members/${projectid}`);
        })
        .catch(err => console.log(err));
    }
  );

  router.get(
    "/members/:projectid/delete/:userid",
    isLoggedIn,
    (req, res, next) => {
      const { projectid, userid } = req.params;
      const sqldelete = `DELETE FROM members WHERE projectid=${projectid} AND userid=${userid}`;

      pool
        .query(sqldelete)
        .then(result => {
          res.redirect(`/projects/members/${projectid}`);
        })
        .catch(err => console.log(err));
    }
  );

  // ================== GET ISSUES =============== \\
  router.get("/issues/:projectid", isLoggedIn, (req, res) => {
    let projectid = req.params.projectid;

    const {
      checkid,
      issuesid,
      checksubject,
      subject,
      checktracker,
      tracker,
      checkdone,
      done
    } = req.query;

    let arr = [];
    let page = req.query.page || 1;
    let limit = 2;
    let offset = (page - 1) * limit;
    let url = req.originalUrl;
    if (!url.includes("page")) {
      url = url.includes("?")
        ? url.replace("?", `?page=${page}&`)
        : `${url}?page=${page}`;
    }

    if (checkid && issuesid) {
      arr.push(`i1.issueid=${issuesid}`); // i1.issueid
    }
    if (checksubject && subject) {
      arr.push(`LOWER(i1.subject) LIKE '%${subject.toLowerCase()}%'`); //i1.subject
    }
    if (checktracker && tracker) {
      arr.push(`LOWER(i1.tracker) LIKE '%${tracker.toLowerCase()}%'`); //i1.tracker
    }
    if (checkdone && done) {
      arr.push(`i1.done=${done}`); //i1.done
    }

    // ================= SQL COUNT ==================== \\
    let sqlcount = `SELECT COUNT(i1.issueid) total FROM issues i1 WHERE projectid=${projectid}`;

    if (arr.length > 0) {
      sqlcount += ` WHERE projectid=${projectid} AND ${arr.join(" AND ")}`;
    }
    sqlcount += `  `;

    pool.query(sqlcount).then(result => {
      let total = result.rows[0].total; // TOTAL DATA PAGE FROM QUERY
      let pages = Math.ceil(total / limit);

      // ============== SQL TABLE ============= \\
      // let sqltable = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) fullname,
      // issues.issueid, projectid, tracker, subject, description, status, priority,
      // assignee, startdate, duedate, estimatedtime, done, files, spenttime, targetversion,
      // author, createddate, updateddate, closeddate, parenttask
      // FROM issues LEFT JOIN users
      // ON issues.assignee=users.userid WHERE projectid=${projectid}`

      // ============== SQL TABLE2 ============ \\
      let sqltable = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) fullname,
            i1.issueid, i1.projectid, i1.tracker, i1.subject, i1.description, i1.status, i1.priority,
            i1.assignee, i1.startdate, i1.duedate, i1.estimatedtime, i1.done, i1.files, i1.spenttime,i1.targetversion, i1.author, CONCAT(u2.firstname, ' ', u2.lastname) authorname, 
			i1.createddate, i1.updateddate, i1.closeddate, i1.parenttask, i2.subject namaparentissue
            FROM issues i1 LEFT JOIN users
            ON i1.assignee=users.userid
			LEFT JOIN users u2
			ON i1.author=u2.userid
			LEFT JOIN issues i2
			ON i1.parenttask = i2.issueid WHERE i1.projectid=${projectid}`;

      if (arr.length > 0) {
        sqltable += ` AND ${arr.join(" AND ")}`;
      }

      // ============== SQL PAGINATION ============== \\
      sqltable += ` ORDER BY i1.issueid LIMIT ${limit} OFFSET ${offset}`;

      // ============== SQL GET OPTION =============== \\
      let sqloption = `SELECT issueopt FROM users WHERE userid=${req.session.user.userid}`;

      const getTable = pool.query(sqltable);
      const getOption = pool.query(sqloption);

      Promise.all([getTable, getOption])
        .then(results => {
          let data = results[0].rows;
          const dataOption = results[1].rows;

          const option = dataOption[0].issueopt;

          // ============== FILE ============== \\
          let gambar = data.map(x => x.files);
          gambar = gambar.map(x => {
            if (x) {
              // ===== REGEX TO GROUP FIND LATEST INDEX ====== \\
              if (
                x.toLocaleLowerCase().match("((.png)|(.jpg)|(.jpeg)|(.ico))$")
              ) {
                // ======= CONVERT TO ATTR HTML ======== \\
                return `<a href=${x}><img src=${x} width="70" height="auto"></a>`;
              }
              return `<a href=${x}>${x}</a>`;
            }
            return "-";
          });
          // ======== AMBIL DATA FILE DOANG ====== \\
          data = data.map((item, index) => {
            item.files = gambar[index];
            return item;
          });

          res.render("projects/issues/list", {
            path: "/projects/issues",
            projectid,
            data,
            option,
            pages,
            page,
            url,
            moment,
            query: req.query,
            error: req.flash("error")[0],
            berhasil: req.flash("berhasil")[0],
            isAdmin: req.session.user.isadmin
          });
        })
        .catch(err => console.log(err));
    });
  });

  // =============== UPDATE OPTION ============= \\
  router.post("/issues/:projectid", isLoggedIn, (req, res, next) => {
    let projectid = req.params.projectid;
    let savekeyoption = Object.keys(req.body);
    let postOption = {
      issuesid: savekeyoption.includes("issuesid"),
      tracker: savekeyoption.includes("tracker"),
      subject: savekeyoption.includes("subject"),
      desciption: savekeyoption.includes("desciption"),
      status: savekeyoption.includes("status"),
      priority: savekeyoption.includes("priority"),
      assignee: savekeyoption.includes("assignee"),
      startdate: savekeyoption.includes("startdate"),
      duedate: savekeyoption.includes("duedate"),
      estimatedtime: savekeyoption.includes("estimatedtime"),
      done: savekeyoption.includes("done"),
      file: savekeyoption.includes("file"),
      spenttime: savekeyoption.includes("spenttime"),
      targetversion: savekeyoption.includes("targetversion"),
      author: savekeyoption.includes("author"),
      createddate: savekeyoption.includes("createddate"),
      updateddate: savekeyoption.includes("updateddate"),
      closeddate: savekeyoption.includes("closeddate"),
      parenttask: savekeyoption.includes("parenttask")
    };

    let sqloption = `UPDATE users SET issueopt='${JSON.stringify(
      postOption
    )}' WHERE userid=${req.session.user.userid}`;

    pool
      .query(sqloption)
      .then(result => {
        req.session.user.issueopt = postOption;
        req.flash("berhasil", "Option Updated!");
        res.redirect(`${projectid}`);
      })
      .catch(err => console.log(err));
  });

  router.get("/issues/:projectid/add", isLoggedIn, (req, res, next) => {
    const projectid = req.params.projectid;

    // ====== QUERY UNTUK DAPAT NAMA PROJECTS ====== \\
    let sqlpjname = `SELECT members.projectid, MAX(projects.name) projectname 
        FROM members INNER JOIN projects USING (projectid) 
        INNER JOIN users USING (userid) WHERE projectid=${projectid} GROUP BY projectid ORDER BY projectid`;

    // ===== QUERY UNTUK GET MEMBER IN PROJECTS ===== \\
    let sqlgetadd = `SELECT MAX(members.userid) userid,
        STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname 
        FROM members INNER JOIN users USING (userid) 
		WHERE projectid=${projectid} GROUP BY userid ORDER BY userid`;

    Promise.all([pool.query(sqlpjname), pool.query(sqlgetadd)])
      .then(results => {
        const datapjname = results[0].rows;
        const data = results[1].rows;
        let pjname = datapjname.map(x => x.projectname);
        let namaassignee = data.map(x => x.fullname);
        let idassignee = data.map(x => x.userid);

        res.render(`projects/issues/add`, {
          path: "/projects/issues",
          projectid,
          data,
          pjname,
          namaassignee,
          idassignee,
          isAdmin: req.session.user.isadmin
        });
      })
      .catch(err => console.log(err));
  });

  router.post("/issues/:projectid/add", isLoggedIn, (req, res, next) => {
    const projectid = req.params.projectid;
    let {
      tracker,
      subject,
      status,
      description,
      priority,
      assignee,
      startdate,
      duedate,
      estimatedtime,
      done,
      files
    } = req.body;

    // ========= MOMENT FOR DATE ======= \\
    startdate = moment(startdate).format("DD-MM-YYYY");
    duedate = moment(duedate).format("DD-MM-YYYY");

    let sqlpostadd = `INSERT INTO issues(projectid, tracker, subject, description, status, priority, assignee, startdate, duedate, estimatedtime, done, createddate, updateddate`;
    let sqlvalue = `VALUES (${projectid}, '${tracker}', '${subject}', '${description}', '${status}', '${priority}', ${assignee}, '${startdate}', '${duedate}', ${estimatedtime}, ${done}, now(), now()`;

    // ======== USER INPUT A FILE ======== \\
    if (req.files) {
      // =========== UPLOAD FILE ============ \\
      let upload = req.files.files;

      // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
      let filename = upload.name.toLowerCase().replace("", Date.now());
      filenamepath = `/images/${filename}`;
      sqlpostadd += ` ,files)`;
      sqlvalue += ` ,'${filenamepath}')`;
      // Use the mv() method to place the file somewhere on your server
      upload.mv(
        path.join(__dirname, "..", "public", "images", filename),
        function(err) {
          if (err) throw err;
          else {
            pool
              .query(sqlpostadd + sqlvalue)
              .then(result => {
                req.flash("berhasil", "Success Added Issue");
                res.redirect(`/projects/issues/${projectid}`);
              })
              .catch(err => console.log(err));
          }
        }
      );
    } else {
      sqlpostadd += `)`;
      sqlvalue += `)`;
      pool
        .query(sqlpostadd + sqlvalue)
        .then(result => {
          req.flash("berhasil", "Success Added Issue");
          res.redirect(`/projects/issues/${projectid}`);
        })
        .catch(err => console.log(err));
    }
  });

  router.get(
    "/issues/:projectid/edit/:issueid",
    isLoggedIn,
    (req, res, next) => {
      const { projectid, issueid } = req.params;
      const thisAuthor = req.session.user.userid;

      // ====== QUERY UNTUK DAPAT NAMA PROJECTS ====== \\
      let sqlpjname = `SELECT members.projectid, MAX(projects.name) projectname 
        FROM members INNER JOIN projects USING (projectid) 
        INNER JOIN users USING (userid) WHERE projectid=${projectid} GROUP BY projectid ORDER BY projectid`;

      // ====== QUERY UNTUK DAPAT ISSUES PROJECTS ====== \\
      let sqlissues = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) fullname,
        issues.issueid, projectid, tracker, subject, description, status, priority,
        assignee, startdate, duedate, estimatedtime, done, files, spenttime, targetversion,
        author, createddate, updateddate, closeddate, parenttask
        FROM issues LEFT JOIN users
        ON issues.assignee=users.userid WHERE projectid=${projectid} AND issueid=${issueid}`;

      // ====== QUERY UNTUK DAPAT AUTHOR PROJECTS ====== \\
      // let sqlauthor = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) fullname,
      // issues.issueid, projectid, author
      // FROM issues LEFT JOIN users
      // ON issues.author=users.userid WHERE projectid=${projectid} AND issueid=${issueid}`

      // ====== QUERY UNTUK DAPAT AUTHOR PROJECTS ====== \\
      let sqlauthor = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) fullname
        FROM users WHERE userid=${thisAuthor}`;

      // ===== QUERY UNTUK DAPAT PARENTTASK ISSUES ===== \\
      const subquery = `SELECT issues.issueid
        FROM issues WHERE projectid=${projectid} AND issueid=${issueid}`;
      let sqlparent = `SELECT issues.issueid, subject FROM issues WHERE issueid NOT IN (${subquery})`;

      Promise.all([
        pool.query(sqlpjname),
        pool.query(sqlissues),
        pool.query(sqlauthor),
        pool.query(sqlparent)
      ]).then(results => {
        const datapj = results[0].rows;
        const data = results[1].rows;
        const dataAuthor = results[2].rows;
        const dataParent = results[3].rows;
        let pjname = datapj.map(x => x.projectname);
        let iduser = dataAuthor.map(x => x.userid);
        let namauser = dataAuthor.map(x => x.fullname);
        let idIssue = dataParent.map(x => x.issueid);
        let namaSubject = dataParent.map(x => x.subject);
        let disabledtracker = data.map(x => x.tracker);

        res.render("projects/issues/edit", {
          path: "/projects/issues",
          data: data[0],
          pjname,
          projectid,
          issueid,
          moment,
          iduser,
          namauser,
          idIssue,
          namaSubject,
          disabledtracker,
          isAdmin: req.session.user.isadmin
        });
      });
    }
  );

  router.post(
    "/issues/:projectid/edit/:issueid",
    isLoggedIn,
    (req, res, next) => {
      const { projectid, issueid } = req.params;
      const {
        tracker,
        subject,
        description,
        status,
        priority,
        duedate,
        done,
        files,
        targetversion,
        spenttime,
        parenttask
      } = req.body;

      if (status == "Closed") {
        sqlpostedit = `UPDATE issues SET tracker='${tracker}', subject='${subject}', description='${description}', status='${status}', priority='${priority}', duedate='${duedate}', done='${done}', spenttime=${spenttime}, targetversion='${targetversion}', author=${req.session.user.userid}, updateddate=now(), closeddate=now(), parenttask=${parenttask}`;
      } else {
        sqlpostedit = `UPDATE issues SET tracker='${tracker}', subject='${subject}', description='${description}', status='${status}', priority='${priority}', duedate='${duedate}', done='${done}', spenttime=${spenttime}, targetversion='${targetversion}', author=${req.session.user.userid}, updateddate=now(), parenttask=${parenttask}`;
      }

      let sqlgetnama = `SELECT CONCAT(users.firstname,' ',users.lastname) fullname
        FROM users WHERE userid=${req.session.user.userid}`;

      if (req.files) {
        // === JIKA ADA FILE YG DI TAMBAH === \\
        let upload = req.files.files;
        let filename = upload.name
          .toLowerCase()
          .split(" ")
          .join("-")
          .replace("", Date.now());
        filenamepath = `/images/${filename}`;
        sqlpostedit += `, files='${filenamepath}' WHERE issueid=${issueid} AND projectid=${projectid}`;
        upload.mv(
          path.join(__dirname, "..", "public", "images", filename),
          function(err) {
            if (err) throw err;
            else {
              Promise.all([pool.query(sqlpostedit), pool.query(sqlgetnama)])
                .then(results => {
                  datanama = results[1].rows;
                  let flname = datanama.map(x => x.fullname);
                  let title = `[${tracker}] ${subject} #${issueid} (${status})`;
                  let descActivity = `#${done} #${spenttime}(Hours)`;
                  let sqlactivity = `INSERT INTO activity(title,description,author,time,projectid) VALUES('${title}','${descActivity}','${flname}', now(), ${projectid})`;

                  pool
                    .query(sqlactivity)
                    .then(result => {
                      req.flash(
                        "berhasil",
                        `Issue #${issueid} Has Been Edited`
                      );
                      res.redirect(`/projects/issues/${projectid}`);
                    })
                    .catch(err => console.log(err));
                })
                .catch(err => console.log(err));
            }
          }
        );
      } else {
        // ===== JIKA TDK MENAMBAH FILE ====== \\
        sqlpostedit += ` WHERE issueid=${issueid} AND projectid=${projectid}`;
        Promise.all([pool.query(sqlpostedit), pool.query(sqlgetnama)])
          .then(results => {
            datanama = results[1].rows;
            let flname = datanama.map(x => x.fullname);
            let title = `[${tracker}] ${subject} #${issueid} (${status})`;
            let descActivity = `#${done} #${spenttime}(Hours)`;
            let sqlactivity = `INSERT INTO activity(title,description,author,time,projectid) VALUES('${title}','${descActivity}','${flname}', now(), ${projectid})`;

            pool
              .query(sqlactivity)
              .then(result => {
                req.flash("berhasil", `Issue #${issueid} Has Been Edited`);
                res.redirect(`/projects/issues/${projectid}`);
              })
              .catch(err => console.log(err));
          })
          .catch(err => console.log(err));
      }
    }
  );

  router.get(
    "/issues/:projectid/delete/:issueid",
    isLoggedIn,
    (req, res, next) => {
      const { projectid, issueid } = req.params;
      let sql = `SELECT issues.status FROM issues WHERE projectid=${projectid} AND issueid=${issueid}`;
      pool
        .query(sql)
        .then(result => {
          if (result.rows[0].status !== "Closed") {
            sqldelete = `DELETE FROM issues WHERE issueid=${issueid} AND projectid=${projectid}`;
            pool
              .query(sqldelete)
              .then(() => {
                req.flash("berhasil", `Issue #${issueid} Has Been Slain`);
                res.redirect(`/projects/issues/${projectid}`);
              })
              .catch(err => console.log(err));
          } else {
            req.flash(
              "error",
              `Issue #${issueid} has been closed. It cannot be deleted!!`
            );
            res.redirect(`/projects/issues/${projectid}`);
          }
        })
        .catch(err => console.log(err));
    }
  );

  return router;
};
