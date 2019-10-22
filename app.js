var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const flash = require("connect-flash");
var session = require('express-session');
const fileUpload = require('express-fileupload')
const { Pool } = require('pg');

var app = express();

// view engine setup

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// PG ADMIN
// const pool = new Pool({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'pms',
//   password: '12345',
//   port: 5432
// });

// PG ADMIN HEROKUUUU
const pool = new Pool({
  user: 'lgiqebipuvrtkm',
  host: 'ec2-174-129-253-101.compute-1.amazonaws.com',
  database: 'd3e0m4rb0v0ni',
  password: 'cb1452c9eb6904d7a3f1f3e0058de663272aece54793566dad4b5fd7c4d4b19f',
  port: 5432
});

var indexRouter = require('./routes/index')(pool);
var projectRouter = require('./routes/projects')(pool);
var profileRouter = require('./routes/profile')(pool);
var usersRouter = require('./routes/users')(pool);



//use session login
app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}))
app.use(fileUpload());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());
app.set("etag", false);
app.use(function (req, res, next) {
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  next();
});
app.use('/', indexRouter);
app.use('/projects', projectRouter);
app.use('/profile', profileRouter);
app.use('/users', usersRouter);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  var express = require('express');
  var router = express.Router();

  module.exports = (pool) => {
    /* GET users listing. */
    router.get('/', function (req, res, next) {
      res.send('respond with a resource');
    });

    return router;
  }

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
