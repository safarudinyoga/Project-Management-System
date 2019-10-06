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

        // let sql = `SELECT projects.projectid, projects.name, users.userid, CONCAT (users.firstname,' ',users.lastname) AS members FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid ORDER BY projectid`

        let sql = `SELECT COUNT(members.projectid) total, MAX(projects.name) projectname, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid) GROUP BY projectid ORDER BY projectid`
        pool.query(sql, (err, count) => {
            let countpage = count.rows[0].total;
            let page = req.query.page || 1;
            let limit = 1;
            let offset = (page - 1) * limit;
            let url = req.url == '/' ? '/?page=1' : req.url;
            let pages = Math.ceil(countpage / limit);
            let sql = `SELECT COUNT(members.projectid) total, MAX(projects.name) projectname, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid) GROUP BY projectid ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`;
            pool.query(sql, [], (err, row) => {
                if (err) throw err;
                res.render('projects/list', {
                    title: 'Projects',
                    data: row.rows,
                    path: "/projects",
                    query: req.query,
                    pages,
                    page,
                    url
                });
            })
        })
    })

    // =============== ADD DATA PROJECT =============== \\
    router.get('/add', isLoggedIn, (req, res, next) => {
        console.log('=======ADD DATA PROJECT=======');
        let sqlgetadd = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) as fullname
        FROM projects LEFT JOIN members ON projects.projectid = members.projectid 
        LEFT JOIN users ON users.userid = members.userid ORDER BY userid`
        pool.query(sqlgetadd, (err, concat) => {
            if (err) throw err;
            const flname = concat.rows.map(x => x.fullname);
            console.log(flname);
            res.render('projects/add', { flname, path: "/projects" });
        })
    })

    //=========HOW TO SEQUENCE(INDEX) BACK TO RESTART=======\\
    //ALTER SEQUENCE projects_projectid_seq RESTART WITH 3\\

    router.post('/add', isLoggedIn, (req, res, next) => {
        let sql = `SELECT nextval('projects_projectid_seq') AS nextid`
        pool.query(sql, (err, data) => {
            const projectid = data.rows[0].nextid
            let sql1 = `INSERT INTO projects(projectid, name) VALUES ('${projectid}','${req.body.addpjname}')`

            pool.query(sql1, (err, data) => {
                if (err) return res.send(err)
                let temp = [];
                if (typeof req.body.member == 'string') {
                    temp.push(`(${req.body.member}, ${projectid})`)
                } else {
                    for (let i = 0; i < req.body.member.length; i++) {
                        temp.push(`(${req.body.member[i]}, ${projectid})`)
                    }
                }
                let sql2 = `INSERT INTO members (userid, roles, projectid) values ${temp.join(',')}`
                pool.query(sql2, (err) => {
                    if (err) return res.send(err)
                    res.redirect('/projects')
                })
            })
        })
    })


    // =============== EDIT DATA =============== \\
    router.get('/edit/:id', isLoggedIn, (req, res, next) => {
        let sql1 = `SELECT concat(users.firstname,' ', users.lastname) as fullname FROM users ORDER BY userid`
        pool.query(sql1, (err, concat) => {
            const flname = concat.rows.map(x => x.fullname);
            let projectid = req.params.id;
            let sqlgetedit = `SELECT * FROM projects WHERE projectid=$1`;
            pool.query(sqlgetedit, [projectid], (err, item) => {
                if (err) throw err;
                console.log(item);
                console.log(sqlgetedit);
                //let projectname = item.rows[0]
                res.render('projects/edit', { item: item.rows[0], flname, path: "/projects" });
            })
        })
    })

    router.post('/edit/:id', isLoggedIn, (req, res, next) => {
        let projectid = req.params.id;
        let sqlpostedit = `UPDATE projects SET name=$1 WHERE projectid=$2`;
        pool.query(sqlpostedit, [req.body.name, projectid], (err) => {
            if (err) throw err;
            console.log("DATA TELAH DIEDIT");
            res.redirect('projects/list')
        })
    })

    // =============== EDIT DATA =============== \\
    router.get('/delete/:id', isLoggedIn, (req, res, next) => {
        let projectid = req.params.id;
        let sqldelete = `DELETE FROM projects WHERE projectid=$1`;
        pool.query(sqldelete, [projectid], (err) => {
            if (err) throw err;
            console.log("Data Project Telah Dihapus");
            res.redirect('/projects')
        })
    })

    return router;
}