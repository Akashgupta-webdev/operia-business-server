const renewalCategoryLabels = Object.freeze({
  passport: "Passport",
  emirates: "Emirates ID",
  visa: "Visa",
  healthInsurance: "Health Insurance",
  establishment: "Establishment Card",
  tradeLicence: "Trade Licence",
  document: "Document",
  driverLicence: "Driver Licence",
  vehicleRegistration: "Vehicle Registration",
  vehicleInsurance: "Vehicle Insurance",
});

// Formats renewal display fields using the record entity and its associated company names.
// Missing names omit separators, and internal company lookup values never reach the response.
export const formatClientRenewalRow = ({ companyNames = [], ...row }) => {
  const categoryLabel = renewalCategoryLabels[row.category] ?? row.category;
  const entityName = row.entity?.trim() || row.clientName?.trim() || null;
  const companyName = [...new Set(companyNames.map((name) => name?.trim()).filter(Boolean))].join(", ");
  return {
    ...row,
    item: entityName ? categoryLabel + " (" + entityName + ")" : categoryLabel,
    entity: [entityName, companyName].filter(Boolean).join(" - ") || null,
  };
};
