import logger from "../../../logger/index.js";
import { ClientCompanyUpdateValidationError } from "../errors/clientCompanyUpdate.error.js";
import { getClientCompanies as getClientCompaniesService } from "../services/clientCompanyQuery.service.js";
import { updateClientCompanyInformation as updateClientCompanyInformationService } from "../services/clientCompanyUpdate.service.js";

// Returns a validated page of Client Companies with selected owning-Client information.
// Aggregation failures are safely logged and delegated to the shared API error handler.
export const getClientCompanies = async (req, res, next) => {
  try {
    const result = await getClientCompaniesService(req.validatedQuery);

    return res.status(200).json({
      data: result.companies,
      page: result.page,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Client Company list lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("Client Company list lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

// Updates the Company selected by its owning Client id using only Joi-normalized fields.
// Persistence failures are safely logged and delegated to the shared API error handler.
export const updateClientCompanyInformation = async (req, res, next) => {
  try {
    const company = await updateClientCompanyInformationService(
      req.validatedParams.id,
      req.validatedBody
    );

    logger.info("Client Company information updated.", {
      clientId: req.validatedParams.id,
      companyId: company._id.toString(),
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.set("ETag", `"${company.version}"`);
    return res.status(200).json({
      data: company,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    const responseError =
      error.name === "ValidationError"
        ? new ClientCompanyUpdateValidationError(
            Object.entries(error.errors).map(([field, validationError]) => ({
              field,
              issue: validationError.message,
            }))
          )
        : error;

    console.error("Client Company information update failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
    });
    logger.error("Client Company information update failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
      clientId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(responseError);
  }
};

const ClientCompanyController = {
  getClientCompanies,
  updateClientCompanyInformation,
};

export default ClientCompanyController;
