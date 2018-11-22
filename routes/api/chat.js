const mongoose = require('mongoose');
const passport = require('passport');
const router = require('express').Router();
const auth = require('../auth');
const Users = mongoose.model('Users');
var path = require('path');

//Get chat html
router.get('/', (req, res, next) => {
    res.sendFile(path.join(__dirname + '/../../chat.html'));
});

//POST regisgter new user
router.post('/register', auth.optional, (req, res, next) => {
  const { body: { user } } = req;

  if(!user.username) {
    return res.status(422).json({
      errors: {
        username: 'is required',
      },
    });
  }

  if(!user.password) {
    return res.status(422).json({
      errors: {
        password: 'is required',
      },
    });
  }

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
        return res.status(400).json({          
          errors: {
            username: 'Username is already taken.',
          },
        });
      }
    });

  
});

//POST login route (optional, everyone has access)
router.post('/login', auth.optional, (req, res, next) => {
  const { body: { user } } = req;

  if(!user.username) {
    return res.status(422).json({
      errors: {
        username: 'is required',
      },
    });
  }

  if(!user.password) {
    return res.status(422).json({
      errors: {
        password: 'is required',
      },
    });
  }

  return passport.authenticate('local', { session: false }, (err, passportUser, info) => {
    if(err) {
      return next(err);
    }

    if(passportUser) {
      const user = passportUser;
      user.token = passportUser.generateJWT();
      
      return res.json({ user: user.toAuthJSON() });
    }

    return res.status(400).info;
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