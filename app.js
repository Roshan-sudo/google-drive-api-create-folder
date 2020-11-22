const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const {google} = require('googleapis');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Connecting to mongoose database.
mongoose.connect('mongodb://localhost:27017/createFolder', {useNewUrlParser: true, useUnifiedTopology: true});

// Creating schema to store user's access token and google Id.
const userSchema = new mongoose.Schema({
  googleId : String,
  accessToken : String
});

// Creating user model
const User = new mongoose.model('User', userSchema);

app.use(session({
	name : 'This is cookie name',
  cookie : { maxAge: 1000* 60 * 60 *24 * 365 },
  secret: 'This is a secret key.',
  resave: false,
  saveUninitialized: false
}));

// Using Passport to save sessions
app.use(passport.initialize());
app.use(passport.session());

// Serialize and Deserialize user.
passport.serializeUser(function(user, done) {
	done(null, user.id);
});
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});

passport.use(new GoogleStrategy({
  	clientID: 'Your_Client_ID',
  	clientSecret: 'Your_Client_Secret',
  	callbackURL: 'Your_Redirect_URL',
  	userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  	},
  	function(accessToken, refreshToken, profile, cb) {
      	User.findOne({googleId : profile.id}, (err, user)=>{
          if(err){
            console.log("Error in fetching user from database.");
            console.log("Error is :");
            console.log(err);
            cb(err);
          }else{
            if(!user){
              // User not present in Database. Saving this user in Database.
              const newUser = new User({
                googleId : profile.id,
                accessToken : accessToken
              });
              newUser.save((error, savedUser)=>{
                if(error){
                  console.log("Error in creating user in Database");
                  console.log("Error is : ");
                  console.log(error);
                }
                return cb(error, savedUser);
              });
            }else{
              // User already present in database. return callback
              return cb(err, user);
            }
          }
        });
    }
));

app.get('/login',
    passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'], accessType: 'offline' }));

app.get('/user/google/redirect',
  	passport.authenticate('google', { failureRedirect: '/' }),
  	function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/');
});

// Home Route
app.get('/', (req, res)=>{
  res.send("Hii, I am home page!");
});

// Route To Create Folder
app.get('/createFolder', (req, res)=>{
  if(!req.user){
    res.send("User is not logged in. Log in using \"/login\" route");
  }
  // Creating google drive client
const oauth2Client = new google.auth.OAuth2(
  'Your_Client_ID',
  'Your_Client_Secret',
  'Your_Redirect_URL'
);
// Creating credentials
const credentials = {
  access_token: req.user.accessToken,
  scope: 'profile email https://www.googleapis.com/auth/drive.file'
};
// setting credentials
oauth2Client.setCredentials(credentials);

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client
});

  var fileMetadata = {
    'name': 'Your_Folder_Name',
    'mimeType': 'application/vnd.google-apps.folder'
  };

      // 1st Method. Creating Syncronously
  // Creating Folder.
  // drive.files.create({
  //   resource: fileMetadata,
  //   fields: 'id'
  // }, function (err, file) {
  //   if (err) {
  //     // Handle error
  //     console.log('Error in creating folder' + err);
  //     res.send(err);
  //   } else {
  //     drive.permissions.create({
  //       fileId : file.data.id,
  //       resource : {
  //         role : 'reader',
  //         type : 'anyone'
  //       }
  //     });
  //     res.send("FOlder created. Folder ID is " + file.data.id);
  //   }
  // });

      // 2st Method. Creating Asyncronously
  // drive.files.create({
  //   resource: fileMetadata,
  //   fields: 'id'
  // })
  // .then((file)=>{
  //   drive.permissions.create({
  //     fileId : file.data.id,
  //     resource : {
  //       role : 'reader',
  //       type : 'anyone'
  //     }
  //   });
  //   res.send("Folder created. Folder ID is " + file.data.id);
  // })
  // .catch((err)=>{
  //   console.log("Error in creating folder " + err);
  //   res.send(err);
  // });

      // 3rd Method Using Async await
  drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  })
  .then(async (file)=>{
    await drive.permissions.create({
      fileId: file.data.id,
      resource: {
        role: 'reader',
        type: 'anyone'
      }
    });
    res.send("Folder created. Folder ID is " + file.data.id);
  })
  .catch((err)=>{
    console.log("Error in creating folder " + err);
    res.send(err);
  });

});

app.listen(3000, (req, res)=>{
  console.log("Listening on port 3000");
});