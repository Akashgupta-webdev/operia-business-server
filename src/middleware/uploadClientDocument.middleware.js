import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
    fields: 10,
  },
});

export const uploadClientServiceDocuments = (req, res, next) => {
  upload.array("documents", 10)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    error.status = 422;
    error.code = "VALIDATION_FAILED";
    error.details = [{ field: "documents", issue: error.message }];
    next(error);
  });
};

// Accepts one Client document using the aggregate endpoint's existing multipart field name.
// Multer failures are normalized to the shared validation error response contract.
export const uploadSingleClientDocument = (req, res, next) => {
  upload.single("documents")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    error.status = 422;
    error.code = "VALIDATION_FAILED";
    error.details = [{ field: "documents", issue: error.message }];
    next(error);
  });
};
