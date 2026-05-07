import {
  DeleteObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
const DO_CONFIG = {
  endpoint: "https://nyc3.digitaloceanspaces.com",
  region: "nyc3",
  credentials: {
    accessKeyId: "DO002RGDJ947DJHJ9WDT",
    secretAccessKey: "e5+/pko6Ojar51Hb8ojUKfq2HtXy+tnGKOfs3rIcEfo",
  },
  spaceName: "smtech-space",
};

const s3Config: S3ClientConfig = {
  endpoint: DO_CONFIG.endpoint,
  region: DO_CONFIG.region,
  credentials: DO_CONFIG.credentials,
  forcePathStyle: true,
};
const s3 = new S3Client(s3Config);
export const deleteFromDigitalOcean = async (
  fileUrl: string
): Promise<any> => {
  try {
    const key = fileUrl.split(`/${DO_CONFIG.spaceName}/`)[1];
    if (!key) throw new Error("Invalid file URL");

    const command = new DeleteObjectCommand({
      Bucket: DO_CONFIG.spaceName,
      Key: key,
    });

    const result = await s3.send(command);
    return result;
  } catch (error) {
    console.error("Failed to delete file from DigitalOcean:", error);
    throw error;
  }
};