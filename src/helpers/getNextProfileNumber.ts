import prisma from "../shared/prisma";

export const getNextProfileNumber = async (): Promise<string> => {
  const counter = await prisma.$runCommandRaw({
    findAndModify: 'counters',
    query: { _id: 'profile' },
    update: { $inc: { seq: 1 } },
    new: true,
    upsert: true,
  });

  const value = (counter as any)?.value as { seq?: number };
  if (!value?.seq) throw new Error('Failed to retrieve profile counter');

  return `USN${String(value.seq).padStart(5, '0')}`;
};