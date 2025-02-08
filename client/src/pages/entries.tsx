
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

  const { data: totalAmount } = useQuery<number>({
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
              <CardTitle>Total Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{entries?.length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">₹{totalAmount || 0}</p>
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
              {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                <TableHead>Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry._id}>
                <TableCell>{entry.name}</TableCell>
                <TableCell>₹{entry.amount}</TableCell>
                <TableCell>{new Date(entry.dateTime).toLocaleString()}</TableCell>
                <TableCell>{entry.status}</TableCell>
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <TableCell>
                    {entry.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            fetch(`/api/entries/${entry._id}/approved`, { method: 'POST' })
                              .then(() => queryClient.invalidateQueries({ queryKey: ["/api/entries"] }))
                              .catch(console.error);
                          }}
                        >
                          Approve
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            fetch(`/api/entries/${entry._id}/rejected`, { method: 'POST' })
                              .then(() => queryClient.invalidateQueries({ queryKey: ["/api/entries"] }))
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
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  name: formData.get('name'),
                                  amount: parseFloat(formData.get('amount') as string),
                                })
                              })
                                .then(() => queryClient.invalidateQueries({ queryKey: ["/api/entries"] }))
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
                            <Button type="submit">
                              Update Entry
                            </Button>
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
