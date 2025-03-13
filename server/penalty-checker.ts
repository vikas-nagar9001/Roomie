import { storage } from "./storage";
import mongoose from "mongoose";

const penaltyIntervals = new Map<string, NodeJS.Timeout>(); // Store intervals per flat

export function clearPenaltyInterval(flatId: string) {

  if (penaltyIntervals.has(flatId)) {
    clearInterval(penaltyIntervals.get(flatId)!);
    penaltyIntervals.delete(flatId);
    console.log(`[INFO] Cleared existing scheduler for Flat ID: ${flatId}`);
  }
}

export async function checkAndApplyPenalties(flatId: string) {
  try {
    if (!flatId) {
      console.error("[ERROR] Flat ID is undefined in checkAndApplyPenalties");
      return;
    }
    console.log("\n------------------------------------------------------------------------")
    console.log(`[INFO] Checking and applying penalties for Flat ID: ${flatId}`);

    const flat = await storage.getFlatById(flatId);
    if (!flat) {
      console.warn(`[WARN] No flat found with ID: ${flatId}`);
      return;
    }

    const settings = await storage.getPenaltySettings(flatId);
    if (!settings) {
      console.warn(`[WARN] No penalty settings found for Flat ID: ${flatId}. Skipping.`);
      return;
    }

    const lastPenalty = settings.lastPenaltyAppliedAt;
    console.log(`[INFO] Last penalty applied on: ${lastPenalty || "Never"}`);

    const warningPeriodDays = settings.warningPeriodDays;
    console.log(`[INFO] Warning period for Flat ${flatId}: ${warningPeriodDays} days`);

    const now = new Date();
    let nextPenaltyDate = lastPenalty ? new Date(lastPenalty) : null;
    if (nextPenaltyDate) {
      nextPenaltyDate.setDate(nextPenaltyDate.getDate() + warningPeriodDays);
    }

    if (!lastPenalty || now >= nextPenaltyDate) {
      console.log(`[INFO] Applying penalties for Flat ID: ${flatId}`);
      await applyPenaltiesForFlat(flat, settings);
      await storage.updateLastPenaltyDate(flatId, now);
      console.log(`[SUCCESS] Penalties applied and last penalty date updated.`);
    } else {
      console.log(`[INFO] No penalty needed. Next penalty date: ${nextPenaltyDate}`);
    }
  } catch (error) {
    console.error(`[ERROR] Error in penalty checker for Flat ID ${flatId}:`, error);
  }
}


// Function to start penalty checker for all flats
export async function startPenaltyCheckers() {
  console.log(`[INFO] Starting penalty checkers for all flats...`);

  const flats = await storage.getAllFlats();

  for (const flat of flats) {
    await setupPenaltyChecker(flat._id.toString());
  }
}


// Function to set up the penalty scheduler
export async function setupPenaltyChecker(flatId: string) {
  if (!flatId) {
    console.error(`[ERROR] Flat ID is undefined in setupPenaltyChecker`);
    return;
  }

  const settings = await storage.getPenaltySettings(flatId);
  if (!settings) {
    console.log(`[WARN] No penalty settings found for Flat ID: ${flatId}. Skipping scheduler.`);
    return;
  }

  const warningPeriodMs = settings.warningPeriodDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  // Clear existing interval if it exists
  clearPenaltyInterval(flatId);
  console.log("\n:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::")
  console.log(`[INFO] Setting up scheduler for Flat ID: ${flatId} (Every ${settings.warningPeriodDays} days)`);

  // Run penalty check immediately for this specific flat
  const flatId2 = flatId;
  await checkAndApplyPenalties(flatId2);

  // Set new interval for this specific flat
  const intervalId = setInterval(() => checkAndApplyPenalties(flatId), warningPeriodMs);
  penaltyIntervals.set(flatId, intervalId);
}


// Function to update scheduler when settings change
export async function updatePenaltyScheduler(flatId: string) {
  console.log(`[INFO] Updating scheduler for Flat ID: ${flatId}`);
  await setupPenaltyChecker(flatId);

}


// Apply penalties for a flat
export async function applyPenaltiesForFlat(flat, settings, extraParam?: string) {
  let deficitUser = 0;
  console.log(`[INFO] Applying penalties for Flat ID: ${flat._id}`);

  const users = await storage.getUsersByFlatId(flat._id);
  if (!users.length) {
    console.log(`[WARN] No users found in Flat ID: ${flat._id}. Skipping.`);
    return;
  }

  console.log(`[INFO] Found ${users.length} users in Flat ID: ${flat._id}`);


  //penalty data
  const penaltyEntries = await storage.getPenaltiesByFlatId(flat._id);
  const totalPenaltyAmount = penaltyEntries.reduce((sum, entry) => sum + entry.amount, 0);


  const entries = await storage.getEntriesByFlatId(flat._id);
  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const fairShare = totalAmount / users.length;

  //after penalty subtract
  const finalTotalAmount = totalAmount-totalPenaltyAmount;
  const finalFairShare = finalTotalAmount / users.length;


  console.log(`[INFO] Total amount contributed: ₹${finalTotalAmount.toFixed(2)}`);
  console.log(`[INFO] Fair share per user: ₹${finalFairShare.toFixed(2)}`);

  for (const user of users) {
  
    const userPenaltyEntries = penaltyEntries.filter(entry => entry.userId._id.toString() === user._id.toString());
    const userPenaltyAmount = userPenaltyEntries.reduce((sum, entry) => sum + entry.amount, 0);

    const userEntries = entries.filter(entry => entry.userId._id.toString() === user._id.toString());
    const userContribution = userEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const finalUserContribution = userContribution - userPenaltyAmount;

    console.log(`[INFO] User ${user._id} contributed: ₹${userContribution.toFixed(2)}`);

    if (finalUserContribution < finalFairShare) {
      const deficit = finalFairShare - finalUserContribution;
      const penaltyAmount = Math.round(finalTotalAmount * (settings.contributionPenaltyPercentage / 100));

      console.log(`[WARN] User ${user._id} has a deficit of ₹${deficit.toFixed(2)}. Applying penalty of ₹${penaltyAmount.toFixed(2)}.`);

      const msg = extraParam ? extraParam :"Automatic" ;
      
      const SYSTEM_USER_ID = new mongoose.Types.ObjectId("000000000000000000000000");
      await storage.createPenalty({
        userId: user._id,
        flatId: flat._id,
        type: "MINIMUM_ENTRY",
        amount: penaltyAmount,
        description:  `${msg} penalty for less entry ₹${finalUserContribution.toFixed(2)} < ₹${finalFairShare}`,
        createdBy: SYSTEM_USER_ID,
        nextPenaltyDate: new Date(),
      });

      deficitUser++;

      console.log(`[SUCCESS] Applied penalty of ₹${penaltyAmount.toFixed(2)} to user ${user._id}`);

    } else {
      console.log(`[INFO] No penalty for User ${user._id}. Contribution is sufficient.`);
    }
  }
  return deficitUser;
}

// Start penalty checkers for all flats
startPenaltyCheckers();
