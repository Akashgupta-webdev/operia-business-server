// Moves legacy Client Company licence values into their nested fields.
// Run in mongosh against the target database before deployment, with writes stopped.
db.clientCompanies.updateMany(
  { $or: [
    { tradeLicenceNumber: { $exists: true } },
    { licenceExpiryDate: { $exists: true } },
  ] },
  [
    { $set: {
      "tradeLicence.tradeLicenceNo": { $cond: [
        { $eq: [{ $type: "$tradeLicence.tradeLicenceNo" }, "missing"] },
        "$tradeLicenceNumber", "$tradeLicence.tradeLicenceNo",
      ] },
      "tradeLicence.tradeLicenceExpiry": { $cond: [
        { $eq: [{ $type: "$tradeLicence.tradeLicenceExpiry" }, "missing"] },
        "$licenceExpiryDate", "$tradeLicence.tradeLicenceExpiry",
      ] },
    } },
    { $unset: ["tradeLicenceNumber", "licenceExpiryDate"] },
  ]
);
