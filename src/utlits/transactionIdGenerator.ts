

import { v4 as uuidv4 } from "uuid";
import prisma from "../shared/prisma";


export const generateUniqueTransactionId = async () => {
  let isUnique = false;
  let transactionId = "";

  while (!isUnique) {
    transactionId = `TRA-${uuidv4()}`;
    const existing = await prisma.payment.findUnique({
      where: { transactionId },
    });
    if (!existing) {
      isUnique = true;
    }
  }

  return transactionId;
};