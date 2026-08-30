import configureCloudinary from "../../../config/cloudinary.js";
import {
  deleteUploadedDocuments,
  uploadDocuments,
} from "../../common/services/document-upload.service.js";
import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import { ClientDocumentNotFoundError } from "../errors/clientDocument.error.js";
import Client from "../models/client.model.js";
import ClientDocument from "../models/clientDocuments.model.js";

// Extracts deletion metadata from legacy Cloudinary URLs that predate stored public identifiers.
// New records use persisted server-only metadata and do not depend on URL parsing.
const getLegacyCloudinaryAsset = (documentURL) => {
  try {
    const parsedURL = new URL(documentURL);
    const segments = parsedURL.pathname.split("/").filter(Boolean);
    const uploadIndex = segments.indexOf("upload");

    if (uploadIndex < 1) {
      return null;
    }

    const resourceType = segments[uploadIndex - 1];
    const assetSegments = segments
      .slice(uploadIndex + 1)
      .filter((segment, index) => index > 0 || !/^v\d+$/.test(segment));

    if (assetSegments.length === 0) {
      return null;
    }

    if (resourceType !== "raw") {
      assetSegments[assetSegments.length - 1] =
        assetSegments[assetSegments.length - 1].replace(/\.[^.]+$/, "");
    }

    return {
      publicId: decodeURIComponent(assetSegments.join("/")),
      resourceType,
    };
  } catch {
    return null;
  }
};

// Creates one Client Document after confirming its owning Client exists, then uploads its file.
// If persistence fails after upload, the new Cloudinary asset is removed as compensation.
export const addClientDocument = async (
  clientId,
  documentInformation,
  file,
  correlationId
) => {
  const clientExists = await Client.exists({ _id: clientId });

  if (!clientExists) {
    throw new ClientNotFoundError();
  }

  const uploads = await uploadDocuments([file], correlationId);
  const [upload] = uploads;

  try {
    return await ClientDocument.create({
      ...documentInformation,
      client: clientId,
      documentTitle: documentInformation.documentTitle ?? file.originalname,
      documentURL: upload.documentUrl,
      cloudinaryPublicId: upload.publicId,
      cloudinaryResourceType: upload.resourceType,
    });
  } catch (error) {
    await deleteUploadedDocuments(uploads);
    throw error;
  }
};

// Removes the Cloudinary asset first and deletes its metadata only after provider confirmation.
// Legacy records fall back to parsing their Cloudinary URL for deletion coordinates.
export const deleteClientDocument = async (documentId) => {
  const document = await ClientDocument.findById(documentId)
    .select("+cloudinaryPublicId +cloudinaryResourceType")
    .exec();

  if (!document) {
    throw new ClientDocumentNotFoundError();
  }

  const asset = document.cloudinaryPublicId
    ? {
        publicId: document.cloudinaryPublicId,
        resourceType: document.cloudinaryResourceType ?? "image",
      }
    : getLegacyCloudinaryAsset(document.documentURL);

  if (asset) {
    const cloudinary = configureCloudinary();
    await cloudinary.uploader.destroy(asset.publicId, {
      resource_type: asset.resourceType,
      invalidate: true,
    });
  }

  const deletedDocument = await ClientDocument.findByIdAndDelete(documentId).exec();
  if (!deletedDocument) {
    throw new ClientDocumentNotFoundError();
  }

  return deletedDocument;
};
