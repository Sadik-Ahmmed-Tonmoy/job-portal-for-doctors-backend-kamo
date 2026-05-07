import { Gender, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../../shared/prisma";

export const initiateSuperAdmin = async () => {
  const payload = {
    userName: "superAdmin",
    email: "superadmin@gmail10p.com",
    password: "12345678",
    role: UserRole.ADMIN,
  };

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { email: payload.email },
    include: { admin: true },
  });

  if (!user) {
    // Create user if it doesn't exist
    user = await prisma.user.create({
      data: {
        email: payload.email,
        fullName: "admin",
        password: hashedPassword,
        role: payload.role,
      },
      include: { admin: true },
    });
  }

  // Check if admin exists
  if (!user.admin) {
    await prisma.admin.upsert({
      where: { email: payload.email },
      update: {
        password: hashedPassword,
        nickName: payload.userName,
        userId: user.id,
        country: "",
        city: "",
        state: "",
        bio: "",
      },
      create: {
        id: user.id,
        email: payload.email,
        password: hashedPassword,
        nickName: payload.userName,
        userId: user.id,
        country: "",
        city: "",
        state: "",
        bio: "",
      },
    });
  }
};

export const createIndexes = async () => {
  try {
    // Create geospatial index on User's location field (since it's Json type)
    await prisma.$runCommandRaw({
      createIndexes: "users",  // Your User model collection
      indexes: [
        {
          key: { location: "2dsphere" },
          name: "location_2dsphere",
        },
      ],
  //      indexes: [
  //   {
  //     key: { 
  //       location: "2dsphere",
  //       facilityProfile: 1 
  //     },
  //     name: "location_facilityProfile_compound",
  //   },
  // ],
    });
    
    console.log("✅ 2dsphere geo index created on users.location");

  } catch (error) {
    // Enhanced error handling
    if (error instanceof Error) {
      // MongoDB error code for "Index already exists"
      if ('code' in error && error.code === 85) {
        console.log("⚠️  Some indexes already exist, skipping duplicates...");
      } else {
        console.error("❌ Error creating indexes:", error.message);
        console.error("Error details:", error);
        throw error;
      }
    } else {
      console.error("❌ Unknown error creating indexes:", error);
      throw new Error("Unknown error occurred while creating indexes");
    }
  }
};

// Function to check and clean up duplicate indexes
export async function checkAndCleanupIndexes() {
  try {
    // console.log("Checking indexes on users collection...");
    
    const indexes = await prisma.$runCommandRaw({
      listIndexes: "users",
    });
    
    // console.log("Current indexes on users collection:", JSON.stringify(indexes, null, 2));
    
    // Look for duplicate 2dsphere indexes
    const geoIndexes = (indexes as any).cursor?.firstBatch?.filter((idx: any) => 
      idx.key?.location === "2dsphere"
    ) || [];
    
    if (geoIndexes.length > 1) {
      console.log(`Found ${geoIndexes.length} 2dsphere indexes. Need to clean up.`);
      
      // Keep the first one, drop the rest
      for (let i = 1; i < geoIndexes.length; i++) {
        const indexName = geoIndexes[i].name;
        console.log(`Dropping duplicate index: ${indexName}`);
        
        await prisma.$runCommandRaw({
          dropIndexes: "users",
          index: indexName,
        });
      }
      
      console.log("Duplicate indexes cleaned up.");
    } else {
      // console.log("No duplicate 2dsphere indexes found.");
    }
    
  } catch (error) {
    console.error("Error checking/cleaning indexes:", error);
  }
}

// export async function dropRegularLocationIndex() {
//   try {
//     console.log("Dropping regular location index...");
    
//     await prisma.$runCommandRaw({
//       dropIndexes: "users",
//       index: "users_location_idx",
//     });
    
//     console.log("✅ Regular location index dropped");
//   } catch (error) {
//     console.error("Error dropping index:", error);
//   }
// }