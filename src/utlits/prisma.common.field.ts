export const passengerProfileSelection = {
  id: true,
  fullName: true,
  dob: true,
  gendar: true,
  avater: true,
  createdAt: true,
  passengerLocation: {
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  },
};

export const driverProfileSelection = {
  id: true,
  fullName: true,
  dob: true,
  avater: true,
  gendar: true,
  vehicleType: true,
  createdAt: true,
  driverLocation: {
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  },
};

export const conversationPrivateFields = {
  id: true,
  user1Id: true,
  user2Id: true,
  lastMessage: true,
  updatedAt: true,
  privateMessage: {
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      content: true,
      imageUrl: true,
      read: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  user1: {
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      passenger: {
        select: {
          fullName: true,
          avater: true,
        },
      },
      driver: {
        select: {
          fullName: true,
          avater: true,
        },
      },
    },
  },
  user2: {
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      passenger: {
        select: {
          fullName: true,
          avater: true,
        },
      },
      driver: {
        select: {
          fullName: true,
          avater: true,
        },
      },
    },
  },
};
