import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { FaClipboardList } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { showLoader, hideLoader, forceHideLoader } from "@/services/loaderService";
import { showSuccess, showError } from "@/services/toastService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomPagination } from "@/components/custom-pagination";
import { Settings } from "lucide-react";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";

import { LuMail, LuCheck, LuX, } from "react-icons/lu";
import { FiUser } from "react-icons/fi";
import favicon from "../../Roomie.png";

interface Payment {
  _id: string;
  userId: {
    name: string;
    profilePicture?: string;
  };
  amount: number;
  status: "PAID" | "PENDING";
}

interface Bill {
  _id: string;
  month: string;
  year: number;
  items: Array<{
    name: string;
    amount: number;
  }>;
  totalAmount: number;
  splitAmount: number;
  dueDate: string;
}

export default function PaymentsPage() {
  const { user, logoutMutation } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  
  // Show loader when the component mounts and set up cleanup
  useEffect(() => {
    showLoader();
    
    // Force hide the loader when component unmounts to prevent stuck loaders
    return () => {
      forceHideLoader();
    };
  }, []);
    // Optional: Set up query refetch handling for additional safety
  // This is useful to catch refetches that happen outside the isLoading tracking
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      // Set a small timeout to ensure all queries have time to settle
      setTimeout(() => {
        if (!queryClient.getQueryState(["/api/payments"])?.isFetching &&
            !queryClient.getQueryState(["/api/bills"])?.isFetching &&
            !queryClient.getQueryState(["/api/users"])?.isFetching) {
          setDataLoading(false);
        }
      }, 100);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
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

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [currentBillsPage, setCurrentBillsPage] = useState(1);
  const itemsPerPage = 6;

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      showLoader();
      try {
        const res = await apiRequest("PUT", "/api/payment-settings", settings);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },    onSuccess: () => {
      setIsSettingsOpen(false);
      showSuccess("Settings updated successfully");
      hideLoader();
    },
    onError: () => {
      hideLoader();
    }  });
  
  // Define queries first, before using them in any effects
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"]
  });
  const { data: bills = [], isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"]
  });
  const { data: users = [], isLoading: usersLoading } = useQuery<{
    _id: string;
    name: string;
  }[]>({
    queryKey: ["/api/users"]
  });
  
  // Manage loading state based on query states - placed after the queries are defined
  useEffect(() => {
    const isLoading = paymentsLoading || billsLoading || usersLoading;
    
    // Update dataLoading based on query states
    setDataLoading(isLoading);
    
    // Hide loader when all queries are done
    if (!isLoading) {
      hideLoader();
    }
  }, [paymentsLoading, billsLoading, usersLoading]);

  const totalReceived = (payments?.reduce((sum, p) =>
    p.status === "PAID" ? sum + p.amount : sum, 0) || 0).toFixed(2);

  const totalPending = (payments?.reduce((sum, p) =>
    p.status === "PENDING" ? sum + p.amount : sum, 0) || 0).toFixed(2);


  const createBillMutation = useMutation({
    mutationFn: async (data: any) => {
      showLoader();
      try {
        const res = await apiRequest("POST", "/api/bills", data);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setIsCreateBillOpen(false);
      showSuccess("Bill created successfully");
      setNewBillItems([{ name: "", amount: "" }]);
      hideLoader();
    },
    onError: () => {
      hideLoader();
    }
  });
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ paymentId, status, amount }: { paymentId: string; status: string; amount: number }) => {
      showLoader();
      try {
        const res = await apiRequest("PATCH", `/api/payments/${paymentId}`, { status, amount });
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      showSuccess("Payment status updated");
      hideLoader();
    },
    onError: () => {
      hideLoader();
    },
  });
  const sendReminderMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      showLoader();
      try {
        const res = await apiRequest("POST", `/api/payments/${paymentId}/remind`);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },    onSuccess: () => {
      showSuccess("Reminder sent successfully");
      hideLoader();
    },
    onError: () => {
      hideLoader();
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

  // Calculate Paginated Data
  const paginatedPayments = payments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedBills = bills.slice((currentBillsPage - 1) * itemsPerPage, currentBillsPage * itemsPerPage);

  return (
    <TooltipProvider>
      <Header />
      <div className="min-h-screen p-8 pt-36 bg-[#0f0f1f]">
        <div className="max-w-7xl mx-auto">
          <div className="relative group mb-8">
            {/* Blurred border layer */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5433a7] rounded-xl blur group-hover:opacity-75 transition"></div>

            {/* Main content */}
            <div className="relative bg-black/50 backdrop-blur-xl rounded-xl p-4 border border-white/10 flex flex-wrap justify-between items-center gap-4">
              <h1 className="text-2xl sm:text-3xl text-white font-bold">Payments</h1>

              <div className="flex gap-2">
                {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                  <>
                    <Button
                      onClick={() => setIsCreateBillOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#582c84] text-white rounded-lg shadow-md transition hover:bg-[#542d87]"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Create Bill</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setIsSettingsOpen(true)}
                      className="flex items-center gap-2 bg-white/80 hover:bg-white/90 text-gray-700"
                    >
                      <Settings className="h-5 w-5" />
                      Settings
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 mb-8">
            <Card className="bg-[#582c84] duration-300 group-hover:scale-105 text-white shadow-xl border border-white/10 rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-semibold text-white">Total Received</CardTitle>
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-green-400">₹{totalReceived}</div>
              </CardContent>
            </Card>

            <Card className="bg-[#582c84] duration-300 group-hover:scale-105 text-white shadow-xl border border-white/10 rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-semibold text-white">Total Pending</CardTitle>
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-yellow-400">₹{totalPending}</div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex flex-wrap gap-2 p-2 border-b border-[#582c84]/30 justify-start bg-[#151525]">
                <TabsTrigger
                  value="status"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "status"
                      ? "bg-[#582c84] text-white"
                      : "text-white/70 hover:bg-[#582c84]/20"
                    }`}
                >
                  Payment Status
                </TabsTrigger>
                <TabsTrigger
                  value="bills"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "bills"
                      ? "bg-[#582c84] text-white"
                      : "text-white/70 hover:bg-[#582c84]/20"
                    }`}
                >
                  Bills
                </TabsTrigger>
              </TabsList>

              <TabsContent value="status" className="mt-4">
                <Table className="w-full overflow-x-auto bg-[#151525] rounded-xl">
                  <TableHeader>
                    <TableRow className="border-none">
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap min-w-[200px]">
                        <span className="block">User</span>
                      </TableHead>
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap">
                        <span className="block">Split Amount</span>
                      </TableHead>
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap">
                        <span className="block">Left Amount</span>
                      </TableHead>
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 border-none">
                        <span className="block">Status</span>
                      </TableHead>
                      {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                        <TableHead className="text-center text-indigo-200/80 font-semibold py-3 border-none">
                          <span className="block">Actions</span>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedPayments?.map((payment: any) => (
                      <TableRow
                        key={payment._id}
                        className="transition duration-200 hover:bg-[#1f1f2e] hover:shadow-inner border-none"
                      >
                        <TableCell className="min-w-[200px] py-4 px-3">
                          <div className="flex items-center gap-3 p-2 rounded-lg border border-[#582c84]/30 bg-[#1c1b2d] shadow-sm">
                            <img
                              src={payment.userId?.profilePicture || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_InUxO_6BhylxYbs67DY7-xF0TmEYPW4dQQ&s"}
                              alt="User"
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-[#582c84]/50 bg-gray-300"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "https://i.pinimg.com/236x/34/cc/de/34ccde761b4737df092c6efec66d035e.jpg";
                              }}
                            />
                            <div className="truncate max-w-[140px] sm:max-w-[180px]">
                              <span className="font-medium text-white">{payment.userId?.name || "Unknown User"}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-semibold text-[#9f5bf7] py-4 px-3">
                          ₹{payment.amount.toFixed(2)}
                        </TableCell>

                        <TableCell className="font-semibold text-[#9f5bf7] py-4 px-3">
                          ₹{payment.leftAmount?.toFixed(2) || "0.00"}
                        </TableCell>

                        <TableCell className="py-4 px-3">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium
                              ${payment.status === "PAID" ? "bg-white/10 text-[#ab6bff]" :
                                payment.status === "PENDING" ? "bg-yellow-200/10 text-yellow-300" :
                                  "bg-red-200/10 text-red-400"}`}
                          >
                            {payment.status}
                          </span>
                        </TableCell>

                        {(user?.role === "ADMIN" || user?.role === "CO_ADMIN") && (
                          <TableCell className="text-center py-4 px-3">
                            <div className="flex justify-center sm:justify-start gap-2">
                              {payment.status === "PENDING" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-white bg-[#582c84] border-[#582c84] hover:bg-[#8e4be4] hover:text-white"
                                  onClick={() => updatePaymentStatusMutation.mutate({
                                    paymentId: payment._id,
                                    status: "PAID",
                                    amount: payment.amount
                                  })}
                                >
                                  Mark as Paid
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-[#151525] text-[#a86ff4] border-[#582c84] hover:bg-[#582c84]/20"
                                onClick={() => sendReminderMutation.mutate(payment._id)}
                              >
                                Send Reminder
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {(!payments || payments.length === 0) ? (
                  <div className="py-8 text-center text-white/60">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FaClipboardList className="w-12 h-12 text-[#582c84] opacity-50" />
                      <p className="text-lg font-medium">No payments found</p>
                      <p className="text-sm text-white/40">Start by creating a new bill!</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center mt-4 mb-20 md:mb-4">
                    <CustomPagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(payments.length / itemsPerPage)}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}

              </TabsContent>

              <TabsContent value="bills" className="mt-4">
                <Table className="w-full overflow-x-auto bg-[#151525] rounded-xl">
                  <TableHeader>
                    <TableRow className="border-none">
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none">Month</TableHead>
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none">Total Amount</TableHead>
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none">Split Amount</TableHead>
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none">Due Date</TableHead>
                      <TableHead className="text-left text-indigo-200/80 font-semibold py-3 border-none">Items</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedBills?.map((bill) => (
                      <TableRow
                        key={bill._id}
                        className="transition duration-200 hover:bg-[#1f1f2e] hover:shadow-inner border-none"
                      >
                        {/* Month + Year — one line only */}
                        <TableCell className="py-4 px-3 text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                          {bill.month} {bill.year}
                        </TableCell>

                        {/* Total Amount */}
                        <TableCell className="font-semibold text-[#9f5bf7] py-4 px-3">
                          ₹{bill.totalAmount.toFixed(2)}
                        </TableCell>

                        {/* Split Amount */}
                        <TableCell className="font-semibold text-[#9f5bf7] py-4 px-3">
                          ₹{bill.splitAmount.toFixed(2)}
                        </TableCell>

                        {/* Due Date — fixed */}
                        <TableCell className="text-gray-400 py-4 px-3 whitespace-nowrap">
                          {format(new Date(bill.dueDate), "MMM d, yyyy")}
                        </TableCell>

                        {/* Items — one line per item, no wrap */}
                        <TableCell className="py-4 px-3">
                          <div className="space-y-1">
                            {bill.items.map((item, index) => (
                              <div
                                key={index}
                                className="text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]"
                              >
                                <span className="text-white/70">{item.name}:</span>{" "}
                                <span className="text-[#9f5bf7]">₹{item.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>

                </Table>

                {(!bills || bills.length === 0) ? (
                  <div className="py-8 text-center text-white/60">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FaClipboardList className="w-12 h-12 text-[#582c84] opacity-50" />
                      <p className="text-lg font-medium">No bills found</p>
                      <p className="text-sm text-white/40">Create your first bill!</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center mt-4 mb-20 md:mb-4">
                    <CustomPagination
                      currentPage={currentBillsPage}
                      totalPages={Math.ceil(bills.length / itemsPerPage)}
                      onPageChange={setCurrentBillsPage}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <Dialog open={isCreateBillOpen} onOpenChange={setIsCreateBillOpen}>
            <DialogContent className="top-[40vh] max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-white">Create Monthly Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleCreateBill();
              }} className="space-y-4">
                {newBillItems.map((item, index) => (
                  <div key={index} className="space-y-2">              <Input
                    type="text"
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => {
                      const newItems = [...newBillItems];
                      newItems[index].name = e.target.value;
                      setNewBillItems(newItems);
                    }}
                    className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                  />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => {
                        const newItems = [...newBillItems];
                        newItems[index].amount = e.target.value;
                        setNewBillItems(newItems);
                      }}
                      className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={addBillItem}
                    variant="outline"
                    className="flex-1 text-white bg-[#151525] border-[#582c84] hover:bg-[#582c84]/20"
                  >
                    Add Item
                  </Button>                  <Button
                    type="submit"
                    className="flex-1 bg-[#582c84] hover:bg-[#542d87] text-white"
                    disabled={createBillMutation.isPending}
                  >
                    {createBillMutation.isPending ? "Creating..." : "Create Bill"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogContent className="top-[60vh] max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-white">Payment Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-white/70">Default Due Days</Label>
                  <Input
                    type="number"
                    value={settings.defaultDueDate}
                    onChange={(e) => setSettings({ ...settings, defaultDueDate: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-white/70">Penalty Amount (₹)</Label>
                  <Input
                    type="number"
                    value={settings.penaltyAmount}
                    onChange={(e) => setSettings({ ...settings, penaltyAmount: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-white/70">Reminder Frequency (days)</Label>
                  <Input
                    type="number"
                    value={settings.reminderFrequency}
                    onChange={(e) => setSettings({ ...settings, reminderFrequency: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={settings.customSplitEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, customSplitEnabled: checked as boolean })}
                    className="h-5 w-5 rounded-md bg-[#1c1b2d] border border-[#582c84] checked:bg-[#582c84] checked:border-[#582c84] focus:ring-2 focus:ring-[#582c84] focus:ring-offset-0 transition duration-150 cursor-pointer hover:bg-[#1f1f2e]"
                  />
                  <Label className="text-sm text-white/70">Enable Custom Split</Label>
                </div>
                <Button
                  onClick={() => updateSettingsMutation.mutate(settings)}
                  className="w-full bg-[#582c84] hover:bg-[#542d87] text-white"
                >
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="block md:hidden fixed bottom-0 left-0 right-0 z-50">
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
