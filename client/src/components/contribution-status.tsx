import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { MdAccessTime } from "react-icons/md";

interface ContributionStatusProps {
    userContribution: number;
    fairShare: number;
    userId: string;
    flatTotalEntry: number;
    totalUsers: number;
}
//////////////////////////////////////////// Timer Component //////////////////////////////////////////
function PenaltyTimer() {
    const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

    const { data: penaltyTimer } = useQuery({
        queryKey: ["/api/penalty-timers"],
    });

    useEffect(() => {
        if (penaltyTimer) {
            const updateTimer = () => {
                const lastPenalty = new Date(penaltyTimer.lastPenaltyAppliedAt);
                const warningDays = penaltyTimer.warningPeriodDays;

                const nextPenaltyDate = new Date(lastPenalty);
                nextPenaltyDate.setDate(nextPenaltyDate.getDate() + warningDays);

                const now = new Date();
                const diffTime = nextPenaltyDate.getTime() - now.getTime();

                if (diffTime > 0) {
                    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);

                    setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
                } else {
                    setTimeRemaining("Penalty Due");
                }
            };

            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [penaltyTimer]);

    if (!penaltyTimer) return null;

    return (
        <div className="flex items-center justify-between p-2 bg-white/10 text-white rounded-md shadow-md">
            <div className="flex items-center gap-2">
                <MdAccessTime className="text-xl" />
                <span className="font-semibold text-sm">Next Penalty In:</span>
            </div>
            <span className="text-sm font-mono font-semibold">{timeRemaining}</span>
        </div>
    );
}
{/* <PenaltyTimer />   use this for render timer*/ }

//////////////////////////////////////////// Timer Component //////////////////////////////////////////

export function ContributionStatus({ userContribution, fairShare, userId, flatTotalEntry, totalUsers }: ContributionStatusProps) {


    const [userPenaltyAmount, setUserPenaltyAmount] = useState(0);
    const [totalPenaltyAmount, setTotalPenaltyAmount] = useState(0);

    useEffect(() => {
        const fetchPenalties = async () => {
            try {
                const response = await fetch("/api/penalties");
                const data = await response.json();

                // Calculate user-specific penalty amount
                const userPenalties = data.filter((penalty: { userId: { _id: string } }) => penalty.userId._id === userId);
                const userTotal = userPenalties.reduce((sum: number, penalty: { amount: number }) => sum + penalty.amount, 0);

                // Calculate total penalty amount for all users
                const overallTotal = data.reduce((sum: number, penalty: { amount: number }) => sum + penalty.amount, 0);

                // Update state
                setUserPenaltyAmount(userTotal);
                setTotalPenaltyAmount(overallTotal);

            } catch (error) {
                console.error("Error fetching penalties:", error);
            }
        };

        fetchPenalties();
    }, [userId]); // Re-fetch if userId changes


    const finalUserContribution = userContribution - userPenaltyAmount;
    const finalFlatTotalEntry = flatTotalEntry - totalPenaltyAmount;
    const finalFairShare = finalFlatTotalEntry / totalUsers;
    //suppose 5 users then each user do 20% entry 
    const fairSharePercentage = (1 / totalUsers) * 100;

    const userContributionPercentage = (finalUserContribution / finalFlatTotalEntry) * 100;



    const deficit = finalFairShare - finalUserContribution;

    //leave user if they do 75% entry of their 20% fair share
    //not show warning 
    // minimum required contribution (75% of the fair share) before a warning is triggered. 🚀
    const fairShareThreshold = (75 * fairSharePercentage) / 100;

    const isDeficit = userContributionPercentage < fairShareThreshold;
    console.log("ft "+fairShareThreshold+"is de" + isDeficit);

    return (
        <Card className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 rounded-lg shadow-lg">
            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Contribution Status</h3>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span>Your Contribution:</span>
                        <span>₹{finalUserContribution.toFixed(2)} ({userContributionPercentage.toFixed(1)}%)</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span>Fair Share:</span>
                        <span>₹{finalFairShare.toFixed(2)} ({fairSharePercentage.toFixed(1)}%)</span>
                    </div>

                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${isDeficit ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{
                                width: `${Math.min((userContributionPercentage / fairSharePercentage) * 100, 100)}%`
                            }}
                        />

                    </div>

                    {isDeficit && (
                        <div className="mt-4 p-4 bg-red-500/20 rounded-lg border border-red-400/50">
                            <div className="flex items-start space-x-3">
                                <div className="mt-1 text-red-300">⚠️</div>
                                <div className="space-y-2 flex-1">
                                    <p className="text-sm font-medium">
                                        You're below your fair share by ₹{deficit.toFixed(2)} ({(deficit / finalFlatTotalEntry * 100).toFixed(1)}%)
                                    </p>
                                    <p className="text-sm font-medium text-yellow-300">
                                        Do minimum ${fairShareThreshold.toFixed(1)}% contribution to avoid penalty
                                    </p>

                                    <p className="text-sm font-medium text-yellow-300">
                                        Penalty may be applied soon
                                    </p>
                                    <PenaltyTimer />


                                </div>

                            </div>
                        </div>
                    )}

                </div>
            </div>
        </Card>
    );
}