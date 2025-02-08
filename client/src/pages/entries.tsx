import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Entry } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function EntriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newEntry, setNewEntry] = useState({ name: "", amount: "" });

  const { data: entries } = useQuery<Entry[]>({
    queryKey: ["/api/entries"],
  });

  const { data: totals } = useQuery<{ userTotal: number; flatTotal: number }>({
    queryKey: ["/api/entries/total"],
  });

  const addEntryMutation = useMutation({
    mutationFn: async (data: { name: string; amount: number }) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      toast({ title: "Entry added successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEntryMutation.mutate({
      name: newEntry.name,
      amount: parseFloat(newEntry.amount),
    });
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Entries</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Entry Name"
                  value={newEntry.name}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, name: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={newEntry.amount}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, amount: e.target.value })
                  }
                />
                <Button type="submit" disabled={addEntryMutation.isPending}>
                  Add Entry
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Overall Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Total Entries:</span>
                <span className="font-bold">
                  {entries?.filter((e) => e.status === "APPROVED").length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-bold">
                  ₹
                  {entries
                    ?.filter((e) => e.status === "APPROVED")
                    .reduce((sum, entry) => sum + entry.amount, 0) || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pending Entries:</span>
                <span className="font-bold">
                  {entries?.filter((e) => e.status === "PENDING").length || 0}
                  (₹
                  {entries
                    ?.filter((e) => e.status === "PENDING")
                    .reduce((sum, entry) => sum + entry.amount, 0) || 0}
                  )
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Total Entries:</span>
                <span className="font-bold bg-secondary px-2 py-1 rounded">
                  {entries?.filter(e => 
                    e.userId.toString() === user?._id.toString()
                  ).length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Approved Amount:</span>
                <span className="font-bold text-green-600">
                  ₹{entries?.filter(e => 
                    e.userId.toString() === user?._id.toString() && 
                    e.status === "APPROVED"
                  ).reduce((sum, entry) => sum + entry.amount, 0) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Pending:</span>
                <div className="text-right">
                  <div className="font-bold text-yellow-600">
                    ₹{entries?.filter(e =>
                      e.userId.toString() === user?._id.toString() &&
                      e.status === "PENDING"
                    ).reduce((sum, entry) => sum + entry.amount, 0) || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entries?.filter(e =>
                      e.userId.toString() === user?._id.toString() &&
                      e.status === "PENDING"
                    ).length || 0} entries
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>User</TableHead>
              {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                <TableHead>Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry._id}>
                <TableCell className="flex items-center gap-2">
                  <img
                    src={entry.user?.profilePicture || "/default-avatar.png"}
                    alt={entry.user?.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <div>{entry.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {entry.user?.name}
                    </div>
                  </div>
                </TableCell>
                <TableCell>₹{entry.amount}</TableCell>
                <TableCell>
                  {new Date(entry.dateTime).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-sm ${
                      entry.status === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : entry.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {entry.status}
                  </span>
                </TableCell>
                <TableCell>{entry.user?.name}</TableCell>
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <TableCell>
                    {entry.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            fetch(`/api/entries/${entry._id}/approved`, {
                              method: "POST",
                            })
                              .then(() => {
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/entries"],
                                });
                                toast({
                                  title: "Entry Approved",
                                  description: `Entry "${entry.name}" has been approved successfully.`,
                                });
                              })
                              .catch(console.error);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            fetch(`/api/entries/${entry._id}/rejected`, {
                              method: "POST",
                            })
                              .then(() => {
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/entries"],
                                });
                                toast({
                                  title: "Entry Rejected",
                                  description: `Entry "${entry.name}" has been rejected.`,
                                  variant: "destructive",
                                });
                              })
                              .catch(console.error);
                          }}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Entry</DialogTitle>
                          </DialogHeader>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              fetch(`/api/entries/${entry._id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  name: formData.get("name"),
                                  amount: parseFloat(
                                    formData.get("amount") as string,
                                  ),
                                }),
                              })
                                .then(() => {
                                  queryClient.invalidateQueries({
                                    queryKey: ["/api/entries"],
                                  });
                                  toast({
                                    title: "Entry Updated",
                                    description: `Entry "${entry.name}" has been updated successfully.`,
                                  });
                                })
                                .catch(console.error);
                            }}
                            className="space-y-4"
                          >
                            <Input
                              name="name"
                              defaultValue={entry.name}
                              placeholder="Entry Name"
                            />
                            <Input
                              name="amount"
                              type="number"
                              defaultValue={entry.amount}
                              placeholder="Amount"
                            />
                            <Button type="submit">Update Entry</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}