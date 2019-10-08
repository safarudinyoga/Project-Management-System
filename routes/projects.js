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
        let arr = [];
        //console.log(req.query);

        if (checkid && projectid) {
            arr.push(`projectid=${projectid}`)
        }
        if (checkname && projectname) {
            arr.push(`LOWER(name) LIKE '%${projectname.toLowerCase()}%'`)
        }
        if (checkmember && member) {
            arr.push(`users.userid=${member}`)
        }
        //console.log(arr);
        // ============ SQL UNTUK MENGHITUNG BANYAK MEMBER ========== \\
        let sql1 = `SELECT COUNT(members.projectid) total, ARRAY_AGG(userid) member, projectid, MAX(projects.name) projectname, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid)`

        // let sql1 = `SELECT DISTINCT projects.projectid, projects.name, users.firstname, users.userid FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid`

        if (arr.length > 0) {
            sql1 += ` WHERE ${arr.join(' AND ')}`
            //console.log(sql1);
        }
        sql1 += ` GROUP BY projectid ORDER BY projectid`
        //console.log(sql1);
    
        pool.query(sql1, (err, count) => {
            if (err) console.log(err);
            //console.log(count);
            let rows = count.rows[0].total;
            let page = req.query.page || 1;
            let limit = 2;
            let offset = (page - 1) * limit;
            let url = req.url == '/' ? '/?page=1' : req.url;
            let pages = Math.ceil(rows / limit);

            //================= SQL UNTUK MENAMPILKAN TABLE DATA PROJECTS ==============\\
            let sql = `SELECT members.projectid, MAX(projects.name) projectname, ARRAY_AGG(userid) member, STRING_AGG(CONCAT(users.firstname, ' ', users.lastname), ', ') fullname FROM members INNER JOIN projects USING (projectid) INNER JOIN users USING (userid)`;

            if (arr.length > 0) {
                sql += ` WHERE ${arr.join(' AND ')}`          
            }

            //================= SQL UNTUK PAGINATION ==============\\
            sql += ` GROUP BY projectid ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`;
            //console.log(sql);

            pool.query(sql, (err, row) => {
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

        // ================ QUERY BUAT MENAMPILKAN ARRAY_AGG & STRING_AGG =============== \\
        // let sqlgetadd = `SELECT ARRAY_AGG(userid) member, STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname FROM members INNER JOIN users USING (userid) INNER JOIN projects USING (projectid) GROUP BY projectid ORDER BY projectid`

        let sqlgetadd = `SELECT users.userid, 
        STRING_AGG(CONCAT(users.firstname,' ',users.lastname), ', ') fullname 
        FROM users GROUP BY userid`;

        // console.log(sqlgetadd);
        pool.query(sqlgetadd, (err, result) => {
            if (err) throw err;
            const flname = result.rows.map(x => x.fullname);
            const elemen = result.rows.map(y => y.userid)
            console.log(flname);
            console.log(elemen);
            //console.log(row.rows);
            res.render('projects/add', { flname, elemen, path: "/projects" });
        })
    })

    //=========HOW TO SEQUENCE(INDEX) BACK TO RESTART=======\\
    //ALTER SEQUENCE projects_projectid_seq RESTART WITH 3\\

    router.post('/add', isLoggedIn, (req, res, next) => {
        let sql = `INSERT INTO projects(name) VALUES ('${req.body.addpjname}')`
        console.log(sql);
        //let sqlnext = `SELECT nextval('projects_projectid_seq') AS nextid`
        pool.query(sql, (err) => {
            //let sql = `INSERT INTO projects(name) VALUES ('${req.body.addpjname}')`
            let sqlnext = `SELECT MAX(projectid) total FROM projects`
            console.log(sqlnext);
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
                console.log(temp);
                let sqladd = `INSERT INTO members (userid, projectid) VALUES ${temp.join(',')}`
                console.log(sqladd);
                pool.query(sqladd, (err) => {
                    if (err) console.log(err);
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