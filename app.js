var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
const { Pool } = require('pg');

var app = express();

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pms',
  password: '12345',
  port: 5432
});

var indexRouter = require('./routes/index')(pool);
var projectRouter = require('./routes/projects')(pool);
var profileRouter = require('./routes/profile')(pool);
var usersRouter = require('./routes/users')(pool);


// view engine setup

app.use(function (req, res, next) {
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  next();
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//use session login
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}))

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
