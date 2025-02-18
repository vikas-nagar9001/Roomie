
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
import { Settings } from "lucide-react";

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
    const splitAmount = parseFloat((totalAmount / (users?.length || 1)).toFixed(2));
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
            <div className="flex gap-3">
              {/* Create Bill Button */}
              <Button
                onClick={() => setIsCreateBillOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path>
                </svg>
                Create Bill
              </Button>

              {/* Settings Button with User Profile Icon */}
              <Button
                variant="outline"
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg shadow-md transition-all"
              >
                <Settings className="w-5 h-5 text-gray-700" />
                Settings
              </Button>
            </div>
          )}
        </div>


        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-xl border border-white/10 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold text-white">Total Received</CardTitle>
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-green-300">₹{totalReceived}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-xl border border-white/10 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold text-white">Total Pending</CardTitle>
              <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2m-2-6a4 4 0 11-4 4"></path>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-yellow-300">₹{totalPending}</div>
            </CardContent>
          </Card>
        </div>



        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap gap-2 p-2 border-b justify-start">
            <TabsTrigger value="status" className="px-4 py-2">Payment Status</TabsTrigger>
            <TabsTrigger value="bills" className="px-4 py-2">Bills</TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Split Amount</TableHead>
                    <TableHead>Left Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                      <TableHead className="text-center">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.map((payment: any) => (
                    <TableRow key={payment._id}>
                      <TableCell className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={payment.userId?.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"}
                            alt={payment.userId?.name}
                          />
                          <AvatarFallback>
                            <img
                              src="https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg"
                              alt={user?.name?.charAt(0).toUpperCase()}
                              className="w-full h-full object-cover"
                            />
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate max-w-[120px] sm:max-w-[160px]">
                          {payment.userId?.name}
                        </div>
                      </TableCell>
                      <TableCell>₹{payment.amount}</TableCell>
                      <TableCell>₹{payment.status === "PENDING" ? payment.amount : 0}</TableCell>
                      <TableCell>
                        <Badge
                          className={`border ${payment.status === "PAID"
                            ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                            : "bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200"
                            }`}
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                        <TableCell className="flex gap-3 justify-center sm:justify-start">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100  transition-all duration-200"
                            onClick={() => sendReminderMutation.mutate(payment._id)}
                          >

                            <LuMail className="h-5 w-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`p-2 rounded-full ${payment.status === "PAID"
                              ? "text-red-500 hover:text-red-700"
                              : "text-green-500 hover:text-green-700"
                              } transition-all duration-200`}
                            onClick={() =>
                              updatePaymentStatusMutation.mutate({
                                paymentId: payment._id,
                                status: payment.status === "PAID" ? "PENDING" : "PAID",
                                amount: payment.amount
                              })
                            }
                          >
                            {payment.status === "PAID" ? <LuX className="h-5 w-5" /> : <LuCheck className="h-5 w-5" />}
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
            <Card className="overflow-x-auto">
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
                      <TableCell>{bill.month} {bill.year}</TableCell>
                      <TableCell>
                        {bill.items.map((item: any) => (
                          <div key={item.name} className="truncate">{item.name}: ₹{item.amount}</div>
                        ))}
                      </TableCell>
                      <TableCell>₹{bill.totalAmount}</TableCell>
                      <TableCell>₹{bill.splitAmount}</TableCell>
                      <TableCell>{format(new Date(bill.dueDate), "PPP")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>



        <Dialog open={isCreateBillOpen} onOpenChange={setIsCreateBillOpen}>
          <DialogContent className="max-w-md w-full p-6 rounded-xl shadow-lg bg-white border border-gray-300">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-gray-900">Create Monthly Bill</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {newBillItems.map((item, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <Input
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...newBillItems];
                      updated[index].name = e.target.value;
                      setNewBillItems(updated);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
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
                    className="w-28 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" onClick={addBillItem} className=" px-4 py-2 flex-1 border-black bg-gray-200 hover:bg-gray-100 transition">
                  Add Item
                </Button>
                <Button
                  className="flex items-center w-28 px-4 gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                  onClick={handleCreateBill}
                  disabled={!newBillItems.some(item => item.name && item.amount)}
                >
                  Create Bill
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-md w-full p-6 rounded-xl shadow-lg bg-white border border-gray-300">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-gray-900">Payment Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Default Due Date</Label>
                <Input
                  type="number"
                  value={settings.defaultDueDate}
                  onChange={(e) => setSettings({ ...settings, defaultDueDate: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Penalty Amount (₹ per day)</Label>
                <Input
                  type="number"
                  value={settings.penaltyAmount}
                  onChange={(e) => setSettings({ ...settings, penaltyAmount: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Reminder Frequency (days)</Label>
                <Input
                  type="number"
                  value={settings.reminderFrequency}
                  onChange={(e) => setSettings({ ...settings, reminderFrequency: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={settings.customSplitEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, customSplitEnabled: checked as boolean })}
                  className="w-5 h-5 border-gray-400 rounded focus:ring-2 focus:ring-purple-500 transition"
                />
                <Label className="text-gray-700 font-medium">Enable Custom Split</Label>
              </div>
              <Button
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                onClick={() => updateSettingsMutation.mutate(settings)}
              >
                <Settings className="w-5 h-5 text-white" />
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
