
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
                    <Button variant="outline" size="sm">
                      {entry.status === "PENDING" ? "Approve" : "Edit"}
                    </Button>
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
