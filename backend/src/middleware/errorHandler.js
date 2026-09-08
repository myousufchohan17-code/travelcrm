function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || (err.message === "Only image files are allowed" ? 400 : 500);
  res.status(status).json({
    message: err.message || "Internal server error",
  });
}

module.exports = { errorHandler };
