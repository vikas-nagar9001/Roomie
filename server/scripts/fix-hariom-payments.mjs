/**
 * One-time fix: Set userName = "Hariom" on all payment records
 * where userId no longer resolves to a live user (deleted user).
 *
 * Run: node server/scripts/fix-hariom-payments.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in .env");
  process.exit(1);
}

const paymentSchema = new mongoose.Schema({}, { strict: false });
const Payment = mongoose.model("Payment", paymentSchema);

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", userSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // Find all payments that have no userName snapshot yet
  const payments = await Payment.find({
    $or: [
      { userName: { $exists: false } },
      { userName: "" },
      { userName: null },
    ],
  }).lean();

  console.log(`📋 Found ${payments.length} payments without userName snapshot`);

  let fixed = 0;
  let alreadyHaveUser = 0;
  let deletedUserFixed = 0;

  for (const p of payments) {
    if (!p.userId) {
      // No userId at all — set as Hariom (deleted user)
      await Payment.updateOne(
        { _id: p._id },
        { $set: { userName: "Hariom", userProfilePicture: "" } }
      );
      deletedUserFixed++;
      fixed++;
      continue;
    }

    // Try to find the user
    const user = await User.findById(p.userId).lean();
    if (user) {
      // User still exists — save their real name
      await Payment.updateOne(
        { _id: p._id },
        { $set: { userName: user.name || "", userProfilePicture: user.profilePicture || "" } }
      );
      alreadyHaveUser++;
      fixed++;
    } else {
      // User is deleted — this is Hariom (the deleted user)
      await Payment.updateOne(
        { _id: p._id },
        { $set: { userName: "Hariom", userProfilePicture: "" } }
      );
      deletedUserFixed++;
      fixed++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Total updated  : ${fixed}`);
  console.log(`   Active users   : ${alreadyHaveUser} (real name saved)`);
  console.log(`   Deleted user   : ${deletedUserFixed} (set as "Hariom")`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected");
}

run().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
