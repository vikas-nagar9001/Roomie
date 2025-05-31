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
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#6636a3]/20 to-purple-500/10 rounded-lg border border-white/10">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-full">
                    <MdAccessTime className="text-xl text-indigo-300" />
                </div>
                <span className="font-medium text-sm text-indigo-200">Next Penalty In:</span>
            </div>
            <span className="text-sm font-mono font-bold bg-black/30 px-3 py-1 rounded-full text-indigo-300">{timeRemaining}</span>
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
    const finalFlatTotalEntry = Math.max(flatTotalEntry - totalPenaltyAmount, 0.01); // Prevent division by zero
    const finalFairShare = finalFlatTotalEntry / totalUsers;
    const fairSharePercentage = (1 / totalUsers) * 100;

    // Calculate contribution percentage safely
    const userContributionPercentage = finalFlatTotalEntry > 0 
        ? (finalUserContribution / finalFlatTotalEntry) * 100 
        : 0;

    const deficit = finalFairShare - finalUserContribution;

    //leave user if they do 75% entry of their 20% fair share
    //not show warning 
    // minimum required contribution (75% of the fair share) before a warning is triggered. 🚀
    const fairShareThreshold = (75 * fairSharePercentage) / 100;

    // Only show deficit if there are entries and user's contribution is below threshold
    const isDeficit = finalFlatTotalEntry > 0 && userContributionPercentage < fairShareThreshold;

    return (
        <Card className="relative group">
            {/* Blurred border layer */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>

            {/* Main content */}
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-6 border border-white/10">
                <div className="space-y-6">
                    {/* Simple header */}
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-[#6636a3] inline-block">
                            💰
                        </span>
                        Contribution Status
                    </h3>

                    {/* Two simple cards for contribution amounts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Your contribution card */}
                        <div className="bg-[#6636a3] p-4 rounded-lg border border-white/10">
                            <div className="text-white/80 text-sm">Your Contribution</div>
                            <div className="text-2xl font-bold text-white mt-1">₹{finalUserContribution.toFixed(2)}</div>
                            <div className="text-white/80 text-sm mt-1">({userContributionPercentage.toFixed(1)}%)</div>
                        </div>

                        {/* Fair share card */}
                        <div className="bg-[#6636a3] p-4 rounded-lg border border-white/10">
                            <div className="text-white/80 text-sm">Expected Fair Share</div>
                            <div className="text-2xl font-bold text-white mt-1">₹{finalFairShare.toFixed(2)}</div>
                            <div className="text-white/80 text-sm mt-1">({fairSharePercentage.toFixed(1)}%)</div>
                        </div>
                    </div>


                    {/* Premium Progress indicator */}
                    <div className="mt-6">
                        <div className="bg-[#151525]/50 p-4 rounded-xl border border-[#6636a3]/30 backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#a86ff4] animate-pulse"></div>
                                    <span className="text-white/80 text-sm font-medium">Contribution Progress</span>
                                </div>
                                <span className={`font-bold text-lg ${
                                    isDeficit ? 'text-red-400' 
                                    : userContributionPercentage >= 100 ? 'text-green-400'
                                    : 'text-[#a86ff4]'
                                }`}>
                                    {Math.min((userContributionPercentage / fairSharePercentage) * 100, 100).toFixed(0)}%
                                </span>
                            </div>
                            
                            {/* Premium Progress Bar */}
                            <div className="relative h-4 bg-[#1a1a2e] rounded-lg overflow-hidden">
                                {/* Animated Background */}
                                <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a2e] via-[#2a2a4e] to-[#1a1a2e] animate-shimmer"></div>
                                
                                {/* Main Progress Bar */}
                                <div
                                    className={`relative h-full transition-all duration-1000 ease-out ${
                                        isDeficit
                                            ? 'bg-gradient-to-r from-red-500 to-red-400'
                                            : userContributionPercentage >= 100
                                            ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                                            : 'bg-gradient-to-r from-[#5433a7] to-[#a86ff4]'
                                    }`}
                                    style={{
                                        width: `${Math.min((userContributionPercentage / fairSharePercentage) * 100, 100)}%`
                                    }}
                                >
                                    {/* Shine Effect */}
                                    <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-lg"></div>
                                </div>
                                
                                {/* Progress Markers */}
                                <div className="absolute inset-0 flex justify-between px-2">
                                    {[25, 50, 75, 100].map((marker) => (
                                        <div 
                                            key={marker} 
                                            className="h-full w-px bg-white/10"
                                            style={{ left: `${marker}%` }}
                                        >
                                            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] text-white/40">
                                                {marker}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Status Text */}
                            <div className="mt-2 text-xs text-white/60">
                                {finalFlatTotalEntry === 0 ? (
                                    <span className="text-white/60">No entries yet. Start contributing! 🚀</span>
                                ) : isDeficit ? (
                                    <span className="text-red-400">Need more contribution to reach target</span>
                                ) : userContributionPercentage >= 100 ? (
                                    <span className="text-green-400">Target achieved! Great job! 🎉</span>
                                ) : (
                                    <span>Keep going, you're making good progress!</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Warning section when deficit */}
                    {isDeficit && (
                        <div className="mt-6 bg-black/30 rounded-lg border border-red-500/20 overflow-hidden">
                            {/* Warning header */}
                            <div className="bg-gradient-to-r from-red-500/20 to-[#6636a3]/20 p-4 border-b border-red-500/20">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">⚠️</span>
                                    <div>
                                        <h4 className="font-semibold text-red-400">Low Contribution Alert</h4>
                                        <p className="text-sm text-white/80 mt-1">
                                            You're behind by ₹{deficit.toFixed(2)} ({(deficit / finalFlatTotalEntry * 100).toFixed(1)}%)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Warning content */}
                            <div className="p-4 space-y-4">
                                {/* Target info */}
                                <div className="bg-[#151525] rounded-lg p-3">
                                    <div className="text-sm text-white/80">
                                        Make minimum {fairShareThreshold.toFixed(1)}% contribution to avoid penalty
                                    </div>
                                </div>

                                {/* Timer */}
                                <div className="space-y-2">
                                    <div className="text-sm text-white/80">Penalty Timer</div>
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