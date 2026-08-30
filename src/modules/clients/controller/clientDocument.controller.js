import logger from "../../../logger/index.js";
import { ClientDocumentValidationError } from "../errors/clientDocument.error.js";
import {
  addClientDocument as addClientDocumentRecord,
  deleteClientDocument as deleteClientDocumentRecord,
} from "../services/clientDocument.service.js";

// Converts model validation failures into the same field-addressable contract as Joi failures.
// This protects the API if persistence constraints become stricter than boundary validation.
const normalizeClientDocumentError = (error) =>
  error.name === "ValidationError"
    ? new ClientDocumentValidationError(
        Object.entries(error.errors).map(([field, validationError]) => ({
          field,
          issue: validationError.message,
        }))
      )
    : error;

// Adds one uploaded document to the Client selected by its validated MongoDB identifier.
// Errors are logged without document metadata and delegated to the shared error handler.
export const addClientDocument = async (req, res, next) => {
  try {
    const document = await addClientDocumentRecord(
      req.validatedParams.id,
      req.validatedBody,
      req.file,
      req.correlationId
    );
    const documentId = document._id.toString();

    logger.info("Client Document created.", {
      clientId: req.validatedParams.id,
      documentId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.location(`/api/v1/client/document/${documentId}`);
    res.set("ETag", `"${document.version}"`);
    return res.status(201).json({
      data: document,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    const responseError = normalizeClientDocumentError(error);
    console.error("Client Document creation failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
    });
    logger.error("Client Document creation failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
      clientId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(responseError);
  }
};

// Deletes one Client Document and its Cloudinary asset by validated MongoDB identifier.
// The response confirms the deleted id without returning stale storage information.
export const deleteDocument = async (req, res, next) => {
  try {
    const documentId = req.validatedParams.id;
    await deleteClientDocumentRecord(documentId);

    logger.info("Client Document deleted.", {
      documentId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    return res.status(200).json({
      data: { id: documentId },
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Client Document deletion failed.", {
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("Client Document deletion failed.", {
      errorName: error.name,
      errorCode: error.code,
      documentId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
