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
  {/* <PenaltyTimer />   use this for render timer*/}
  
  //////////////////////////////////////////// Timer Component //////////////////////////////////////////
export function ContributionStatus({ userContribution, fairShare, userId, flatTotalEntry, totalUsers }: ContributionStatusProps) {
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

    // Fetch penalty settings
    const { data: penaltySettings } = useQuery({
        queryKey: ["/api/penalty-settings"],
    });

    // Fetch user's latest penalty
    const { data: penalties } = useQuery({
        queryKey: ["/api/penalties"],
    });

    useEffect(() => {
        if (penalties && penaltySettings) {
            // Find user's latest penalty
            const userPenalties = penalties.filter((p: any) => p.userId === userId);
            const latestPenalty = userPenalties.length > 0 ?
                userPenalties.reduce((latest: any, current: any) =>
                    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
                ) : null;

            if (latestPenalty) {
                const nextPenaltyDate = new Date(latestPenalty.createdAt);
                nextPenaltyDate.setDate(nextPenaltyDate.getDate() + penaltySettings.warningPeriodDays);

                const updateCountdown = () => {
                    const now = new Date();
                    const diffTime = nextPenaltyDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffTime > 0) {
                        const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);

                        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
                        setDaysRemaining(diffDays);
                    } else {
                        setTimeRemaining(null);
                        setDaysRemaining(null);
                    }
                };

                // Update immediately
                updateCountdown();

                // Update every second
                const interval = setInterval(updateCountdown, 1000);

                return () => clearInterval(interval);
            }
        }
    }, [penalties, penaltySettings, userId]);

    const contributionPercentage = (userContribution / flatTotalEntry) * 100;
    const fairSharePercentage = ((flatTotalEntry / totalUsers) / flatTotalEntry) * 100;
    const deficit = fairShare - userContribution;
    const isDeficit = deficit > 0;

    return (
        <Card className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 rounded-lg shadow-lg">
            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Contribution Status</h3>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span>Your Contribution:</span>
                        <span>₹{userContribution.toFixed(2)} ({contributionPercentage.toFixed(1)}%)</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span>Fair Share:</span>
                        <span>₹{fairShare.toFixed(2)} ({fairSharePercentage.toFixed(1)}%)</span>
                    </div>

                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${isDeficit ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{
                                width: `${Math.min((contributionPercentage / fairSharePercentage) * 100, 100)}%`
                            }}
                        />

                    </div>

                    {isDeficit && (
                        <div className="mt-4 p-4 bg-red-500/20 rounded-lg border border-red-400/50">
                            <div className="flex items-start space-x-3">
                                <div className="mt-1 text-red-300">⚠️</div>
                                <div className="space-y-2 flex-1">
                                    <p className="text-sm font-medium">
                                        You're below your fair share by ₹{deficit.toFixed(2)} ({(deficit / flatTotalEntry * 100).toFixed(1)}%)
                                    </p>
                                    {daysRemaining !== null && (
                                        <div className="bg-red-500/30 p-2 rounded space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-yellow-300">
                                                    Next penalty in:
                                                </span>
                                                <span className="text-yellow-300 font-bold">
                                                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            {timeRemaining && (
                                                <div className="flex items-center justify-center">
                                                    <span className="text-xl font-mono font-bold text-yellow-300">
                                                        {timeRemaining}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {daysRemaining === null && (
                                        <>
                                        <p className="text-sm font-medium text-yellow-300">
                                            Penalty may be applied soon
                                        </p>
                                        <PenaltyTimer /> 
                                        </>
                                    )}
                                </div>
                                
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </Card>
    );
}