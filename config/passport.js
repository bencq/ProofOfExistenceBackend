const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const config = require('./config');

// Load User model
const User = require('../model/User');

module.exports = (passport) => {
  var opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
  opts.secretOrKey = config.secret;
  passport.use(
    new JwtStrategy(opts, (jwt_payload, done) => {
      let {username} = jwt_payload;
      console.log(jwt_payload);
      User.findOne({ username: username }).then((user) => {
        if (user) {
          console.log(user);
          return done(null, user, { info: "info"});
        } else {
          console.log(user);
          return done(null, false, { info: "info" });
        }
      });
    })
  );
};
