var express = require('express');
var router = express.Router();
const moment = require('moment');
const { isLoggedIn } = require('../helpers/util');
moment().format();

module.exports = (pool) => {

    // =============== GET DATA & FILTER =============== \\
    router.get('/', isLoggedIn, (req, res, next) => {

        // ============ SQL UNTUK MENAMPILKAN BANYAK MEMBER ========== \\
        // let sql = `SELECT members.projectid, MAX(projects.name) projectname, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid) GROUP BY projectid ORDER BY projectid`

        // ============ SQL CONCAT MEMBER ========== \\
        // let sql = `SELECT projects.projectid, projects.name, users.userid, CONCAT (users.firstname,' ',users.lastname) AS members FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid ORDER BY projectid`

        const { checkid, projectid, checkname, projectname, checkmember, member } = req.query;

        // =================== SQL MULTIPLE MEMBER ON FILTER =============== \\
        const subsubquery = `SELECT projectid FROM members WHERE userid=${member}`;
        const subquery = `SELECT userid FROM members WHERE projectid IN (${subsubquery})`;
        // `users.userid IN ( ${subquery} ) AND proj.projectid IN ( ${subsubquery} )`

        let arr = [];
        let page = req.query.page || 1;
        let limit = 3;
        let offset = (page - 1) * limit;
        let url = (req.url == '/') ? '/?page=1' : req.url;

        if (checkid && projectid) {
            arr.push(`projectid=${projectid}`);
        }
        if (checkname && projectname) {
            arr.push(`LOWER(name) LIKE '%${projectname.toLowerCase()}%'`);
        }
        if (checkmember && member) {
            arr.push(`users.userid IN ( ${subquery} ) AND projects.projectid IN ( ${subsubquery} )`);
        }

        // ============ SQL UNTUK MENAMPILKAN FILTER ========== \\
        let sqlfilter = `SELECT COUNT(members.projectid) total, ARRAY_AGG(userid) member, projectid, MAX(projects.name) projectname, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid)`

        // let sql1 = `SELECT DISTINCT projects.projectid, projects.name, users.firstname, users.userid FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid`

        if (arr.length > 0) {
            sqlfilter += ` WHERE ${arr.join(' AND ')}`;
        }
        sqlfilter += ` GROUP BY projectid ORDER BY projectid`;
        console.log(sqlfilter);

        pool.query(sqlfilter, (err, result) => {

            if (err) console.log(err);
            let total = result.rows.length
            let pages = Math.ceil(total / limit);

            // ================= METHOD REDUCE ============= \\
            //let total = result.rows.map(x => Number(x.total)).reduce((total, el) => total + el, 0);

            // ================= SQL UNTUK MENAMPILKAN TABLE DATA PROJECTS ============== \\
            let sql = `SELECT members.projectid, MAX(projects.name) projectname, ARRAY_AGG(userid) member, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid)`;

            if (arr.length > 0) {
                sql += ` WHERE ${arr.join(' AND ')}`;
            }

            // ================= SQL UNTUK PAGINATION ============== \\
            sql += ` GROUP BY projectid ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`;

            // ================ SQL UNTUK MENAMPILKAN SEMUA MEMBER DI FILTER =========== \\
            let sqluser = `SELECT users.userid, 
            CONCAT(users.firstname,' ',users.lastname) fullname 
            FROM users GROUP BY userid`;

            let sqloption = `SELECT projectopt FROM users WHERE userid = ${req.session.user.userid}`;

            const getTable = pool.query(sql);
            const getUsers = pool.query(sqluser);
            const getOption = pool.query(sqloption);

            // =========== PROMISE UNTUK MENRENDER SQL DENGAN TUJUAN YG BERBEDA ======= \\
            Promise.all([getTable, getUsers, getOption]).then(results => {
                const data = results[0].rows;
                const dataUsers = results[1].rows;
                const dataOption = results[2].rows;
                // console.log(dataOption);
                // console.log(dataOption[0].projectopt);
                let flname = dataUsers.map(x => x.fullname);
                let elemen = dataUsers.map(y => y.userid);
                console.log(flname);
                console.log(elemen);
                res.render('projects/list', {
                    title: 'Projects',
                    data,
                    path: "/projects",
                    query: req.query,
                    pages,
                    page,
                    url,
                    flname,
                    elemen,
                    option: dataOption[0].projectopt,
                });
            }).catch(err => console.error(err)); //CATCH HARUS DI DEFINISI
        })
    })

    // =============== OPTION DATA PROJECT =============== \\  
    router.post("/", isLoggedIn, (req, res, next) => {

        console.log('===== APPLY OPTION PROJECT =====');
        let saveKey = Object.keys(req.body)
        let simpanObjek = {
            projectid: saveKey.includes('projectid'),
            projectname: saveKey.includes('projectname'),
            members: saveKey.includes('members')
        }

        // ========= SQL TANPA QUERY BINDING '[]' DI POOL.QUERY ======== \\
        // let sqlopt = `UPDATE users SET projectopt='${JSON.stringify(simpanObjek)}' WHERE userid=${req.session.user.userid}`;

        let sqlopt = `UPDATE users SET projectopt=$1 WHERE userid=${req.session.user.userid}`;

        pool.query(sqlopt, [simpanObjek], (err, item) => {
            if (err) throw err;
            req.session.user.projectopt = simpanObjek;
            res.redirect('/projects')
        })
    })

    // =============== ADD DATA PROJECT =============== \\
    router.get('/add', isLoggedIn, (req, res, next) => {

        console.log('=======ADD DATA PROJECT=======');

        // ================ QUERY BUAT MENAMPILKAN ARRAY_AGG & STRING_AGG =============== \\
        // let sqlgetadd = `SELECT ARRAY_AGG(userid) member, STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname FROM members INNER JOIN users USING (userid) INNER JOIN projects USING (projectid) GROUP BY projectid ORDER BY projectid`

        let sqlgetadd = `SELECT users.userid, 
        STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname 
        FROM users GROUP BY userid`;

        pool.query(sqlgetadd, (err, result) => {
            if (err) throw err;
            const flname = result.rows.map(x => x.fullname);
            const elemen = result.rows.map(y => y.userid);
            res.render('projects/add', { flname, elemen, path: "/projects" });
        })
    })

    //=========HOW TO SEQUENCE(INDEX) BACK TO RESTART=======\\
    //ALTER SEQUENCE projects_projectid_seq RESTART WITH 3\\

    router.post('/add', isLoggedIn, (req, res, next) => {

        let sql = `INSERT INTO projects(name) VALUES ('${req.body.addpjname}')`;

        pool.query(sql, (err) => {
            let sqlnext = `SELECT MAX(projectid) total FROM projects`
            pool.query(sqlnext, (err, result) => {
                if (err) return res.send(err);
                let temp = [];
                const projectId = result.rows[0].total;
                if (typeof req.body.member == 'string') {
                    temp.push(`(${req.body.member}, ${projectId})`)
                } else {
                    for (let i = 0; i < req.body.member.length; i++) {
                        temp.push(`(${req.body.member[i]}, ${projectId})`)
                    }
                }
                let sqladd = `INSERT INTO members (userid, projectid) VALUES ${temp.join(', ')}`
                pool.query(sqladd, (err) => {
                    if (err) res.send(err);
                    res.redirect('/projects')
                })
            })
        })
    })


    // =============== EDIT DATA =============== \\
    router.get('/edit/:id', isLoggedIn, (req, res, next) => {

        let sqledit = `SELECT users.userid, concat(users.firstname,' ', users.lastname) as fullname FROM users ORDER BY userid`
        pool.query(sqledit, (err, result) => {
            const userdata = result.rows;
            let projectid = req.params.id;

            let sqlgetedit = `SELECT members.projectid, MAX(projects.name) nama, ARRAY_AGG(userid) member, 
            STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname 
            FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid) 
            WHERE projectid=$1 GROUP BY projectid ORDER BY projectid`;

            pool.query(sqlgetedit, [projectid], (err, item) => {
                if (err) throw err;
                let elemenedit = item.rows.map(x => x.member)
                res.render('projects/edit', { item: item.rows[0], elemenedit, userdata, path: "/projects" });
            })
        })
    })

    router.post('/edit/:id', isLoggedIn, (req, res, next) => {
        
        let projectid = req.params.id;
        let sqlpostedit = `UPDATE projects SET name='${req.body.name}' WHERE projectid=${projectid}`;
        pool.query(sqlpostedit, (err) => {
            if (err) throw err;
            let sqldeletemembertemp = `DELETE FROM members WHERE projectid = ${projectid}`;
            pool.query(sqldeletemembertemp, (err) => {
                let temp = [];
                if (typeof req.body.member == 'string') {
                    temp.push(`(${req.body.member}, ${projectid})`)
                } else {
                    for (let i = 0; i < req.body.member.length; i++) {
                        temp.push(`(${req.body.member[i]}, ${projectid})`)
                    }
                }
                let sql = `INSERT INTO members (userid, projectid) VALUES ${temp.join(', ')}`
                pool.query(sql, (err) => {
                    if (err) res.send(err);
                    res.redirect('/projects')
                })
            })
        })
    })

    // =============== DELETE DATA =============== \\
    router.get('/delete/:id', isLoggedIn, (req, res, next) => {
        let projectid = req.params.id;
        let sqldelete = `DELETE FROM members WHERE projectid=${projectid}`;
        pool.query(sqldelete, (err) => {
            if (err) throw err;
            console.log("Data Project Telah Dihapus");
            res.redirect('/projects')
        })
    })

    return router;
}