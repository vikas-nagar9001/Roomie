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
import { useToast } from "@/hooks/use-toast";

export default function EntriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newEntry, setNewEntry] = useState({ name: "", amount: "" });
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const { data: entries } = useQuery({
    queryKey: ["/api/entries"],
  });

  const { data: totals } = useQuery({
    queryKey: ["/api/entries/total"],
  });

  const addEntryMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      toast({ title: "Entry added successfully" });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await addEntryMutation.mutateAsync({
        name: newEntry.name,
        amount: parseFloat(newEntry.amount),
      });

      setNewEntry({ name: "", amount: "" }); // Reset input fields
      setOpen(false); // Close the popup
    } catch (error) {
      console.error("Error adding entry:", error);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Entries</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}>Add Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Entry Name"
                  value={newEntry.name}
                  onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
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
              <div className="flex justify-between items-center">
                <span>Total Amount:</span>
                <div className="text-right">
                  <div className="font-bold text-green-600">
                    ₹
                    {entries
                      ?.filter((e) => e.status === "APPROVED")
                      .reduce((sum, entry) => sum + entry.amount, 0) || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entries?.filter((e) => e.status === "APPROVED").length ||
                      0}{" "}
                    Entries
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Pending:</span>
                <div className="text-right">
                  <div className="font-bold text-yellow-600">
                    ₹
                    {entries
                      ?.filter((e) => e.status === "PENDING")
                      .reduce((sum, entry) => sum + entry.amount, 0) || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entries?.filter((e) => e.status === "PENDING").length || 0}{" "}
                    Entries
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Total Amount:</span>
                <div className="text-right">
                  <div className="font-bold text-green-600">
                    ₹
                    {entries
                      ?.filter(
                        (e) =>
                          e.userId.toString() === user?._id.toString() &&
                          e.status === "APPROVED",
                      )
                      .reduce((sum, entry) => sum + entry.amount, 0) || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entries?.filter(
                      (e) =>
                        e.userId.toString() === user?._id.toString() &&
                        e.status === "APPROVED",
                    ).length || 0}{" "}
                    Entries
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Pending:</span>
                <div className="text-right">
                  <div className="font-bold text-yellow-600">
                    ₹
                    {entries
                      ?.filter(
                        (e) =>
                          e.userId.toString() === user?._id.toString() &&
                          e.status === "PENDING",
                      )
                      .reduce((sum, entry) => sum + entry.amount, 0) || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entries?.filter(
                      (e) =>
                        e.userId.toString() === user?._id.toString() &&
                        e.status === "PENDING",
                    ).length || 0}{" "}
                    Entries
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Entry Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
              {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                <TableHead>Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry._id}>
                {/* User Info */}
                <TableCell className="min-w-[180px]">
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    {/* Profile Picture */}
                    <img
                      src={entry.user?.profilePicture || "/default-avatar.png"}
                      alt={entry.user?.name || "User"}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-secondary"
                      onError={(e) => {
                        const target = e.target;
                        target.src = "/default-avatar.png";
                      }}
                    />
                    {/* Name */}
                    <div className="truncate max-w-[120px] sm:max-w-[160px]">
                      <div className="font-medium">
                        {entry.user?.name || "Unknown User"}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Entry Name */}
                <TableCell className="font-medium min-w-[150px] truncate">
                  {entry.name}
                </TableCell>

                {/* Amount */}
                <TableCell>₹{entry.amount}</TableCell>

                {/* Date */}
                <TableCell>
                  {new Date(entry.dateTime).toLocaleString()}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-sm ${entry.status === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : entry.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                  >
                    {entry.status}
                  </span>
                </TableCell>

                {/* Admin Actions */}
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
                      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
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
                                    formData.get("amount")
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
                                  setOpenEdit(false); // Close the edit dialog
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