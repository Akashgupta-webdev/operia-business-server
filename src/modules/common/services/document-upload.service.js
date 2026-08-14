import configureCloudinary from "../../../config/cloudinary.js";

const uploadBuffer = (file, folder) =>
  new Promise((resolve, reject) => {
    const cloudinary = configureCloudinary();
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          documentUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
        });
      }
    );

    stream.end(file.buffer);
  });

export const uploadDocuments = async (files, correlationId) => {
  const folder = `insurance-crm/client-services/${correlationId}`;
  const uploads = [];

  try {
    for (const file of files) {
      uploads.push(await uploadBuffer(file, folder));
    }
    return uploads;
  } catch (error) {
    await deleteUploadedDocuments(uploads);
    throw error;
  }
};

export const deleteUploadedDocuments = async (uploads) => {
  if (uploads.length === 0) {
    return;
  }

  const cloudinary = configureCloudinary();
  await Promise.allSettled(
    uploads.map((upload) =>
      cloudinary.uploader.destroy(upload.publicId, {
        resource_type: upload.resourceType,
        invalidate: true,
      })
    )
  );
};
