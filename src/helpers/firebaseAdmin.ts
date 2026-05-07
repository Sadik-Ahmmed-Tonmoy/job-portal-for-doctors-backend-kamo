import admin from "firebase-admin";
import { serviceAccount } from "../app/routes/serviceAccount";




admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
});

export default admin;
