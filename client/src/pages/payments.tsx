
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LuPlus, LuMail, LuCheck, LuX, LuSettings } from "react-icons/lu";

export default function PaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("status");
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newBillItems, setNewBillItems] = useState([{ name: "", amount: "" }]);
  const [settings, setSettings] = useState({
    defaultDueDate: 5,
    penaltyAmount: 50,
    reminderFrequency: 3,
    customSplitEnabled: false
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await apiRequest("PUT", "/api/payment-settings", settings);
      return res.json();
    },
    onSuccess: () => {
      setIsSettingsOpen(false);
      toast({ title: "Settings updated successfully" });
    }
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["/api/bills"],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const totalReceived = payments?.reduce((sum, p) => 
    p.status === "PAID" ? sum + p.amount : sum, 0) || 0;

  const totalPending = payments?.reduce((sum, p) => 
    p.status === "PENDING" ? sum + p.amount : sum, 0) || 0;

  const createBillMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/bills", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setIsCreateBillOpen(false);
      toast({ title: "Bill created successfully" });
      setNewBillItems([{ name: "", amount: "" }]);
    },
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ paymentId, status, amount }: { paymentId: string; status: string; amount: number }) => {
      const res = await apiRequest("PATCH", `/api/payments/${paymentId}`, { status, amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Payment status updated" });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/remind`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reminder sent successfully" });
    },
  });

  const handleCreateBill = () => {
    const items = newBillItems.filter(item => item.name && item.amount);
    if (items.length === 0) return;

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const splitAmount = totalAmount / (users?.length || 1);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (settings.defaultDueDate || 5));

    createBillMutation.mutate({
      items: items.map(item => ({ 
        name: item.name,
        amount: Number(item.amount)
      })),
      totalAmount,
      splitAmount,
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear(),
      dueDate
    });
  };

  const addBillItem = () => {
    setNewBillItems([...newBillItems, { name: "", amount: "" }]);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <h1 className="text-3xl font-bold">Payments</h1>
          {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
            <div className="flex gap-2">
              <Button onClick={() => setIsCreateBillOpen(true)}>
                <LuPlus className="mr-2 h-4 w-4" />
                Create Bill
              </Button>
              <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
                <LuSettings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalReceived}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">₹{totalPending}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="status">Payment Status</TabsTrigger>
            <TabsTrigger value="bills">Bills</TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Split Amount</TableHead>
                    <TableHead>Left Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                      <TableHead>Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.map((payment: any) => (
                    <TableRow key={payment._id}>
                      <TableCell className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={payment.userId?.profilePicture || "/default-avatar.png"}
                            alt={payment.userId?.name}
                          />
                          <AvatarFallback>
                            {payment.userId?.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {payment.userId?.name}
                      </TableCell>
                      <TableCell>₹{payment.amount}</TableCell>
                      <TableCell>
                        ₹{payment.status === "PENDING" ? payment.amount : 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={payment.status === "PAID" ? "default" : "secondary"}
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                        <TableCell className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendReminderMutation.mutate(payment._id)}
                          >
                            <LuMail className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updatePaymentStatusMutation.mutate({
                                paymentId: payment._id,
                                status: payment.status === "PAID" ? "PENDING" : "PAID",
                                amount: payment.amount
                              })
                            }
                          >
                            {payment.status === "PAID" ? (
                              <LuX className="h-4 w-4" />
                            ) : (
                              <LuCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="bills">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Split Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills?.map((bill: any) => (
                    <TableRow key={bill._id}>
                      <TableCell>
                        {bill.month} {bill.year}
                      </TableCell>
                      <TableCell>
                        {bill.items.map((item: any) => (
                          <div key={item.name}>
                            {item.name}: ₹{item.amount}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>₹{bill.totalAmount}</TableCell>
                      <TableCell>₹{bill.splitAmount}</TableCell>
                      <TableCell>
                        {format(new Date(bill.dueDate), "PPP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isCreateBillOpen} onOpenChange={setIsCreateBillOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Monthly Bill</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {newBillItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...newBillItems];
                      updated[index].name = e.target.value;
                      setNewBillItems(updated);
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => {
                      const updated = [...newBillItems];
                      updated[index].amount = e.target.value;
                      setNewBillItems(updated);
                    }}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={addBillItem}>
                Add Item
              </Button>
              <Button
                className="w-full"
                onClick={handleCreateBill}
                disabled={!newBillItems.some(item => item.name && item.amount)}
              >
                Create Bill
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Due Date</Label>
                <Input
                  type="number"
                  value={settings.defaultDueDate}
                  onChange={(e) => setSettings({...settings, defaultDueDate: parseInt(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label>Penalty Amount (₹ per day)</Label>
                <Input
                  type="number"
                  value={settings.penaltyAmount}
                  onChange={(e) => setSettings({...settings, penaltyAmount: parseInt(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label>Reminder Frequency (days)</Label>
                <Input
                  type="number"
                  value={settings.reminderFrequency}
                  onChange={(e) => setSettings({...settings, reminderFrequency: parseInt(e.target.value)})}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={settings.customSplitEnabled}
                  onCheckedChange={(checked) => setSettings({...settings, customSplitEnabled: checked as boolean})}
                />
                <Label>Enable Custom Split</Label>
              </div>
              <Button 
                className="w-full" 
                onClick={() => updateSettingsMutation.mutate(settings)}
              >
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
