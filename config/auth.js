module.exports = {
    ensureAuthenticated: function(req, resp, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      req.flash('error_msg', 'Please log in to view that resource');
      resp.send("not logined!")
    },
    forwardAuthenticated: function(req, resp, next) {
      if (!req.isAuthenticated()) {
        return next();
      }
      resp.send("logined")
    }
  };
  