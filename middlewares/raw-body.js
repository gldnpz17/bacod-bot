module.exports.rawBodyMiddleware = async (req, res, next) => {
  try {
    let data = "";
    req.on('data', function(chunk){ data += chunk})
    req.on('end', function(){
        req.rawBody = data;
        next();
    });
  } catch (err) {
    next(err);
  }
};