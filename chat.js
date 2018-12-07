//chat.js
//author: Jannik Renner 752776, Sonja Czernotzky 742284


const mongoose = require('mongoose');
const passport = require('passport');
const router = require('express').Router();
const auth = require('./auth');
const Users = mongoose.model('Users');
var fs = require('fs');
var path = require('path');
var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');

//Get chat html
router.get('/', (req, res, next) => {
    res.sendFile(path.join(__dirname + '/chat.html'));
});

//POST regisgter new user
router.post('/register', auth.optional, (req, res, next) => {
  const { body: { user } } = req;

  if(!user.username || user.username == '' || user.username == undefined) {
    return res.status(422).json({
      error: 'Username is required'
    });
  }

  var regEx1 = new RegExp("[ \r\n\t\f ]");
  var regEx2 = new RegExp("<([a-z]+) *[^/]*?>");
  if(regEx1.test(user.username) || regEx2.test(user.username)){
    return res.status(422).json({
      error: 'Username not matching criteria.'
    });
  }

  if(!user.password || user.password == '' ||user.password == undefined) {
    return res.status(422).json({
      error: 'Username is required'
    });
  }

  if(user.profilePicture !== null){ //Check if profile picture contains a human face
    
    /*
    //Face recognition
    var visualRecognition = new VisualRecognitionV3({
      version: '2018-03-19',
      iam_apikey: 'L5CPLIKfCJEttQbt-e7ttx1J4IHCaJ5n3ECsneYUVB9p',
      headers: {
        'X-Watson-Learning-Opt-Out': 'true'
      }
    });
    
    var images_file = user.profilePicture.file; //Convert the base64 into something that the api can use... ??

    var params = {
      images_file: images_file
    };

    visualRecognition.detectFaces(params, function(err, response) {
      if (err) { 
        console.log(err);
      } else {
        console.log(JSON.stringify(response, null, 2))

        //PROCEED

        //Check if user already exists
        
        return Users.findOne({username:user.username})
          .then((existingUser) => {

            //Create user
            if(!existingUser) {
              const finalUser = new Users(user);
              finalUser.setPassword(user.password);
              return finalUser.save()
                .then(() => res.json({ user: finalUser.toAuthJSON() 
              }));
                    
            }else{
              //Send error that user already exists
              return res.status(422).json({          
                error: 'Username already exists'
              });
            }
        });
        
      }
    });
    */
  }else{  //Register user without profile picture

    //Check if user already exists
    return Users.findOne({username:user.username})
    .then((existingUser) => {

      //Create user
      if(!existingUser) {
        const finalUser = new Users(user);
        finalUser.setPassword(user.password);
        res.setHeader("Content-Security-Policy", "script-src 'self' https://nerdychat.mybluemix.net/");
        res.setHeader("X-Content-Type-Options", "nosniff");
        return finalUser.save()
          .then(() => res.json({ user: finalUser.toAuthJSON() 
        }));
              
      }else{
        //Send error that user already exists
        return res.status(422).json({          
          error: 'Username already exists'
        });
      }
    });

  }
});

//POST login route (optional, everyone has access)
router.post('/login', auth.optional, (req, res, next) => {
  const { body: { user } } = req;

  if(!user.username || user.username == '' || user.username == undefined) {
    return res.status(422).json({
      error: 'Username is required'
    });
  }

  if(!user.password || user.password == '' ||user.password == undefined) {
    return res.status(422).json({
      error: 'Username is required'
    });
  }

  return passport.authenticate('local', { session: false }, (err, passportUser, info) => {
    if(err) {
      return next(err);
    }

    if(passportUser) {
      const user = passportUser;
      user.token = passportUser.generateJWT();

      res.setHeader("Content-Security-Policy", "script-src 'self' https://nerdychat.mybluemix.net/");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.json({ user: user.toAuthJSON() });
    }

    return res.status(422).json({
      error: 'Username or Password incorrect'
    });
  })(req, res, next);
});

//GET current route (required, only authenticated users have access)
router.get('/current', auth.required, (req, res, next) => {
  const { payload: { id } } = req;

  return Users.findById(id)
    .then((user) => {
      if(!user) {
        return res.sendStatus(400);
      }

      return res.json({ user: user.toAuthJSON() });
    });
});


module.exports = router;