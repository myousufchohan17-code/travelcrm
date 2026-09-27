function errorHandler(err, _req, res, _next) {
  const databaseErrors = {
    "23503": [400, "A related record no longer exists. Refresh and select an existing linked record."],
    "1452": [400, "A related record no longer exists. Refresh and select an existing linked record."],
    "23505": [409, "This record conflicts with an existing unique value."],
    "1062": [409, "This record conflicts with an existing unique value."],
    "22P02": [400, "One or more values have an invalid format."],
    "22007": [400, "A date or time value is invalid."],
    "22003": [400, "A numeric value is outside the supported range."],
    "1264": [400, "A numeric value is outside the supported range."],
    "1292": [400, "A date, time, or numeric value is invalid."],
    "1366": [400, "A value has an invalid format."],
    "23502": [400, "A required value is missing."],
    "1048": [400, "A required value is missing."],
    "23514": [400, "The record does not satisfy a database constraint."],
  };
  const databaseError = databaseErrors[String(err.code || err.errno || "")];
  const status = err.status || databaseError?.[0] || (err.message === "Only image files are allowed" ? 400 : 500);
  if (status >= 500) console.error(err);
  else console.warn(`Request rejected (${status}): ${databaseError?.[1] || err.message || "Invalid request"}`);
  res.status(status).json({
    message: databaseError?.[1] || err.message || "Internal server error",
  });
}

module.exports = { errorHandler };
