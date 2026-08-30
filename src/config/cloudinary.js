import { v2 as cloudinary } from "cloudinary";

// Creates the stable API error used when Cloudinary credentials cannot be resolved.
// Keeping configuration failures explicit prevents raw SDK errors from reaching callers.
const createUploadConfigurationError = () => {
  const error = new Error("Cloudinary upload configuration is unavailable.");
  error.status = 500;
  error.code = "UPLOAD_CONFIGURATION_ERROR";
  return error;
};

// Resolves Cloudinary credentials after environment loading and verifies every required value.
// CLOUDINARY_URL is re-read explicitly because ESM imports may initialize the SDK before dotenv.
const configureCloudinary = () => {
  try {
    if (process.env.CLOUDINARY_URL?.trim()) {
      cloudinary.config(true);
    } else {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
      const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
      const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

      if (!cloudName || !apiKey || !apiSecret) {
        throw createUploadConfigurationError();
      }

      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }

    const resolvedConfiguration = cloudinary.config();
    if (
      !resolvedConfiguration.cloud_name ||
      !resolvedConfiguration.api_key ||
      !resolvedConfiguration.api_secret
    ) {
      throw createUploadConfigurationError();
    }

    cloudinary.config({ secure: true });
    return cloudinary;
  } catch (error) {
    if (error.code === "UPLOAD_CONFIGURATION_ERROR") {
      throw error;
    }

    throw createUploadConfigurationError();
  }
};

export default configureCloudinary;
