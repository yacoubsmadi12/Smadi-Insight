import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  try {
    const existingAdmin = await db.select().from(users).where(eq(users.email, "admin"));
    
    if (existingAdmin.length > 0) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("admin", 10);
    
    await db.insert(users).values({
      email: "admin",
      password: hashedPassword,
      name: "Administrator",
      role: "admin",
    });

    console.log("Admin user created successfully!");
    console.log("Login with: admin / admin");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
}

seedAdmin();
