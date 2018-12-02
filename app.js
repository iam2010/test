var createError = require('http-errors');
var express = require('express');
var flash = require('connect-flash');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var url = require('url');
var querystring = require('querystring');
var dialog = require('dialog');
var mongoose = require('mongoose');
mongoose.connect('mongodb://abhinav:pass1234@ds135653.mlab.com:35653/attendance_management',{useNewUrlParser:true});
mongoose.plugin(require('mongoose-regex-search'));
var session = require('express-session')
var indexRouter = require('./routes/index');
var subjectRouter = require('./routes/subject');
var loginRouter = require('./routes/login');
var dashboardRouter = require('./routes/dashboard');
var statusRouter = require('./routes/status')
var User = require('./models/user');


//MONGOOSE INITIALIZATION
mongoose.Promise = global.Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
var mongoose = require('mongoose');


// view engine setup
var app = express();
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));




//ROUTES
app.use('/', indexRouter);
app.use('/subject', subjectRouter);
app.use('/login', loginRouter);
app.use('/dashboard', dashboardRouter);
app.use('/status',statusRouter);


app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}))

//CONNECT FLASH
app.use(flash());
app.use((req,res,next)=>{
  res.locals.messages = require('express-messages')(req,res);
    next();
})



//LOGIN
app.post('/login',(req,res)=>{
  var username = req.body.Name;
  var password = req.body.Password;
  console.log(username,password);
  var b = User.loginModel.find({user:username, pass: password});
  b.exec((err,doc)=>{
    if(err){
      console.log(err);
    }
    else if(doc.length!=0){
      console.log(doc[0].user+doc[0].pass+' -app.js');
       res.redirect('/dashboard?session=0FAB3CF577ABF75EF246F53AE&id='+doc[0]._id+'&user='+doc[0].user);
    }
    else{
      dialog.err("Incorrect username or password");
       res.redirect('/login');
    }
  })
})




//SUBJECT ENTRY
app.post('/dashboard', (req, res) => {
  var rawUrl = req.headers.referer;
  console.log(rawUrl+' -app.js')
  var parsedUrl = url.parse(rawUrl);
  var parsedQs = querystring.parse(parsedUrl.query);
  console.log(parsedQs.user+' -app.js 2');
  var subjectModel = mongoose.model(parsedQs.user,User.classSchema);
  if(req.body.semester && req.body.section){
    var subject = new subjectModel({
        subCode : req.body.subcode,
        subName : req.body.subname,
        semester : req.body.semester,
        section : req.body.section,
        strength : req.body.strength
    });
    subject.save(function(err,register){
      if(err) return console.log(err);
    });
    dialog.info('Subject added')
    res.redirect(rawUrl);
  }
  else{
    subjectModel.findOneAndDelete({subCode : req.body.subCode , subName : req.body.subName},(err,doc)=>{
      console.log(doc);
    })
  }
});






//REGISTER
app.post('/register', (req, res) => {
  var rawUrl = req.headers.referer;
  var parsedUrl = url.parse(rawUrl);
  var parsedQs = querystring.parse(parsedUrl.query);
  var subjectModel = mongoose.model(parsedQs.user,User.classSchema);

  subjectModel.findById(parsedQs.id,(err,docs)=>{
    var subject = docs.subName;
    var currClass = docs.semester+docs.section;
    var collection = subject+currClass;
    var strength = docs.strength;
    console.log('collection-'+collection);
    var presentStudents = req.body.student;
    var attendanceModel = mongoose.model('attendance',User.attendanceSchema,collection)
    var totalModel = mongoose.model('total',User.totalSchema,collection);

    attendanceModel.findOne({rollNo : 1},(err,docs)=>{
      if(docs){
        dialog.info('Class already registered');
         res.redirect(rawUrl);
      }
      else{
        for(var i=1; i<=strength; i++){
          var student = {
            rollNo : i,
            attendance : 0
          }
        attendanceModel.create(student);
        }
        var mongoId = new mongoose.mongo.ObjectId(parsedQs.id);
        console.log('id-'+mongoId)
        totalModel.create({_id: mongoId,total : 0});
        dialog.info('class registered');
        res.redirect(rawUrl);
      }
    })
  })
});






//ATTENDANCE
app.post('/attendance', (req, res) => {
  var rawUrl = req.headers.referer;
  var parsedUrl = url.parse(rawUrl);
  var parsedQs = querystring.parse(parsedUrl.query);
  var subjectModel = mongoose.model(parsedQs.user,User.classSchema);

  subjectModel.findById(parsedQs.id,(err,docs)=>{
    var subject = docs.subName;
    var currClass = docs.semester+docs.section;
    var collection = subject+currClass;
    var strength = docs.strength;
    console.log('collection-'+collection);
    var presentStudents = req.body.student;
    var attendanceModel = mongoose.model('attendance',User.attendanceSchema,collection)
    var totalModel = mongoose.model('total',User.totalSchema,collection);

    attendanceModel.find({rollNo : 1},(err,docs)=>{
      if(docs){
        console.log('docs-'+docs);
        totalModel.findByIdAndUpdate(parsedQs.id,{$inc : {total : 1}},(err,doc)=>{
          console.log(doc)
        })
        presentStudents.forEach(element => {
          console.log(element)
          attendanceModel.findOneAndUpdate({rollNo : element},{$inc : {attendance : 1}},(err,doc)=>{
            console.log('doc-'+doc);
          })
        });
        dialog.info('Attendance taken');
         res.redirect(rawUrl);
      }
      else{
        dialog.info('Class not registered');
        res.redirect(rawUrl);
      }
    })
  })
});





//ATTENDANCE STATUS
app.post('/status', (req, res) => {
  var collection = req.body.subject + req.body.semester + req.body.section;
  var rollNo = req.body.rollNo;
  var statusModel = mongoose.model('attendance',User.attendanceSchema,collection);
  statusModel.findOne({rollNo : rollNo},(err,doc)=>{
    res.write('<body style="background-color:#1a2333"><h1 style="text-align:center;color:white;">Classes attended: '+doc.attendance+'</h1></body>')
  })
});







// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

//module.exports = app;

app.listen(process.env.PORT || 3000, () => {
  console.log('connected');
});
