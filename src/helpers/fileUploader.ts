import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const mimetype = file.mimetype;


    cb(null, true);
    // Allow specific image types, and all audio/video types
  },
});

// Upload single images
const selfie = upload.single("selfie");
const promotionImage=upload.single("promotionImage")
const profileImage = upload.single("profileImage");
const chatImage = upload.single("chatImage");
const communityPostDoc=upload.fields([
  { name: "imageUrl", maxCount: 1 },
  { name: "videoUrl", maxCount: 1 },
])
const uploadUserImages = upload.fields([
  { name: "selfie", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },

  { name: "gallery", maxCount: 6 },
]);

const providerDocument = upload.single("document");

const providerDocumentAndImage = upload.fields([
  { name: "document", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
  { name: "BLS", maxCount: 1 },
  { name: "ACLS", maxCount: 1 },
  { name: "PALS", maxCount: 1 },
  { name: "DIPLOMA", maxCount: 1 },
  { name: "LICENCE", maxCount: 1 },
]);

const providerBLS = upload.single("BLS");
const providerACLS = upload.single("ACLS");
const providerPALS = upload.single("PALS");
const providerDIPLOMA = upload.single("DIPLOMA");
const providerLICENCE = upload.single("LICENCE");

export const fileUploader = {
  selfie,
  profileImage,
  chatImage,
  uploadUserImages,
  providerDocument,
  providerDocumentAndImage,
  communityPostDoc,
  promotionImage,
  providerBLS,
  providerACLS,
  providerPALS,
  providerDIPLOMA,
  providerLICENCE,
};
