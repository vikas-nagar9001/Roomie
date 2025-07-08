import { storage } from "./storage";
import mongoose from "mongoose";

const penaltyIntervals = new Map<string, NodeJS.Timeout>(); // Store intervals per flat

export function clearPenaltyInterval(flatId: string) {

  if (penaltyIntervals.has(flatId)) {
    clearInterval(penaltyIntervals.get(flatId)!);
    penaltyIntervals.delete(flatId);
  }
}

export async function checkAndApplyPenalties(flatId: string) {
  try {
    if (!flatId) {
   
      return;
    }
    

    const flat = await storage.getFlatById(flatId);
    if (!flat) {
   
      return;
    }

    const settings = await storage.getPenaltySettings(flatId);
    if (!settings) {
    
      return;
    }

    const lastPenalty = settings.lastPenaltyAppliedAt;
   
    const warningPeriodDays = settings.warningPeriodDays;
    
    const now = new Date();
    let nextPenaltyDate = lastPenalty ? new Date(lastPenalty) : null;
    if (nextPenaltyDate) {
      nextPenaltyDate.setDate(nextPenaltyDate.getDate() + warningPeriodDays);
    }

    if (!lastPenalty || (nextPenaltyDate && now >= nextPenaltyDate)) {
    
      const deficitUsers = await applyPenaltiesForFlat(flat, settings) || 0; // Get count of penalized users, default to 0
      await storage.updateLastPenaltyDate(flatId, now);

      // 📢 Send flat announcement about automatic penalty completion
      if (deficitUsers > 0) {
        try {
          const { PushNotificationService } = await import('./push-notification-service.js');
          const notificationService = new PushNotificationService(flatId);
          await notificationService.sendFlatAnnouncement(
            `⏰ Automatic penalty check completed. ${deficitUsers} user(s) have been penalized for insufficient contribution. Check penalties section for details.`
          );
          console.log(`📢 Sent automatic penalty announcement to flat ${flatId}: ${deficitUsers} users penalized`);
        } catch (notificationError) {
          console.error(`❌ Failed to send automatic penalty announcement for flat ${flatId}:`, notificationError);
        }
      } else {
        console.log(`✅ Automatic penalty check completed for flat ${flatId}: No users penalized`);
      }
   
    } else {
    
    }
  } catch (error) {
    }
}


// Function to start penalty checker for all flats
export async function startPenaltyCheckers() {


  const flats = await storage.getAllFlats();

  for (const flat of flats) {
    await setupPenaltyChecker(flat._id.toString());
  }
}


// Function to set up the penalty scheduler
export async function setupPenaltyChecker(flatId: string) {
  if (!flatId) {

    return;
  }

  const settings = await storage.getPenaltySettings(flatId);
  if (!settings) {

    return;
  }

  const warningPeriodMs = settings.warningPeriodDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  // Clear existing interval if it exists
  clearPenaltyInterval(flatId);

  // Run penalty check immediately for this specific flat
  const flatId2 = flatId;
  await checkAndApplyPenalties(flatId2);

  // Set new interval for this specific flat
  const intervalId = setInterval(() => checkAndApplyPenalties(flatId), warningPeriodMs);
  penaltyIntervals.set(flatId, intervalId);
}


// Function to update scheduler when settings change
export async function updatePenaltyScheduler(flatId: string) {
  await setupPenaltyChecker(flatId);

}


// Apply penalties for a flat
export async function applyPenaltiesForFlat(flat: any, settings: any, extraParam?: string) {
  let deficitUser = 0;

  const users = await storage.getUsersByFlatId(flat._id);
  if (!users.length) {
    return;
  }


  //penalty data
  const penaltyEntries = await storage.getPenaltiesByFlatId(flat._id);
  const totalPenaltyAmount = penaltyEntries.reduce((sum, entry) => sum + entry.amount, 0);

  //flat data
  const entries = await storage.getEntriesByFlatId(flat._id);
  // Filter out entries with 'PENDING' or 'REJECTED' status
  const approvedEntries = entries.filter(entry => entry && entry.status !== 'PENDING' && entry.status !== 'REJECTED');
  const totalAmount = approvedEntries.reduce((sum, entry) => sum + (entry?.amount || 0), 0);
  const fairShare = totalAmount / users.length;
  const totalUsers = users.length;

  //after penalty subtract
  const finalFlatTotalEntry = totalAmount-totalPenaltyAmount;
  const finalFairShare = finalFlatTotalEntry / users.length;


  //leave user if they do 75% entry of their 20% fair share
    //not show warning 
    // minimum required contribution (75% of the fair share) before a warning is triggered. 🚀
    const fairSharePercentage = (1 / totalUsers) * 100;
    const fairShareThreshold = (75 * fairSharePercentage) / 100;



  for (const user of users) {
  
    const userPenaltyEntries = penaltyEntries.filter(entry => {
      const entryUserId = typeof entry.userId === 'string' ? entry.userId : (entry.userId as any)?._id?.toString() || entry.userId;
      return entryUserId === user._id.toString();
    });
    const userPenaltyAmount = userPenaltyEntries.reduce((sum, entry) => sum + entry.amount, 0);

    const userEntries = approvedEntries.filter(entry => entry && entry.userId._id.toString() === user._id.toString());
    const userContribution = userEntries.reduce((sum, entry) => sum + (entry?.amount || 0), 0);
    const finalUserContribution = userContribution - userPenaltyAmount;
    const userContributionPercentage = (finalUserContribution / finalFlatTotalEntry) * 100;


    // Check if user is selected for penalties or if no users are specifically selected
  const isUserSelected = settings.selectedUsers && settings.selectedUsers.length > 0 ?
    settings.selectedUsers.some((id: any) => id?.toString() === user._id.toString()) :
    true; // If no users are selected, apply to all



  if (userContributionPercentage < fairShareThreshold && isUserSelected) {
    try {
      const deficit = finalFairShare - finalUserContribution;
      const penaltyAmount = Math.round(finalFlatTotalEntry * (settings.contributionPenaltyPercentage / 100));

      const msg = extraParam ? extraParam : "Automatic";
      
      const SYSTEM_USER_ID = new mongoose.Types.ObjectId("000000000000000000000000"); 
      const createdPenalty = await storage.createPenalty({
        userId: user._id,
        flatId: flat._id,
        type: "MINIMUM_ENTRY",
        amount: penaltyAmount,
        description: `${msg} penalty for less entry ₹${finalUserContribution.toFixed(2)} < ₹${finalFairShare}`,
        createdBy: SYSTEM_USER_ID.toString(),
        nextPenaltyDate: new Date(),
      });

      // 🔔 Send individual penalty notification to the penalized user
      try {
        const { PushNotificationService } = await import('./push-notification-service.js');
        const notificationService = new PushNotificationService(flat._id);
        
        const penaltyTitle = `⚖️ ${msg} Penalty Applied`;
        const penaltyMessage = `You've been penalized ₹${penaltyAmount} for low contribution. Your contribution ₹${finalUserContribution.toFixed(2)} is below the required ₹${finalFairShare.toFixed(2)}.`;
        
        await notificationService.pushToUser(penaltyTitle, penaltyMessage, user._id.toString());
        console.log(`📧 Penalty notification sent to user ${user.name}`);
      } catch (notificationError) {
        console.error(`❌ Failed to send penalty notification to user ${user._id}:`, notificationError);
      }

      deficitUser++;

      console.log(`✅ Penalty applied for user ${user.name}: ₹${penaltyAmount} for low contribution`);
    } catch (error) {
      console.error(`❌ Failed to apply penalty for user ${user._id}:`, error);
    }
  }
  }
  return deficitUser;
}

// Start penalty checkers for all flats
startPenaltyCheckers();
