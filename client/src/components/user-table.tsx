import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

interface UserTableProps {
  search: string;
}

export function UserTable({ search }: UserTableProps) {
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/users/${userId}/resend-invite`);
    },
  });

  const filteredUsers = users?.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="overflow-x-auto">
      <Table className="border border-gray-300 shadow-sm rounded-lg">
        <TableHeader className="bg-gray-100">
          <TableRow>
            <TableHead className="text-gray-700">Name</TableHead>
            <TableHead className="text-gray-700">Email</TableHead>
            <TableHead className="text-gray-700">Role</TableHead>
            <TableHead className="text-gray-700">Status</TableHead>
            <TableHead className="text-gray-700">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers?.map((user) => (
            <TableRow key={user._id} className="hover:bg-gray-50 transition">
              <TableCell className="min-w-[200px]">
                <div className="flex items-center gap-3">
                  <img
                    src={user.profilePicture || "/default-avatar.png"}
                    alt={user.name || "User"}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-gray-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/default-avatar.png";
                    }}
                  />
                  <div className="truncate max-w-[140px] sm:max-w-[180px]">
                    <span className="font-medium text-gray-800">
                      {user.name || "Unknown User"}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge
                  className={`px-3 py-1 text-sm font-semibold ${
                    user.role === "ADMIN"
                      ? "bg-blue-900 text-white"
                      : user.role === "CO_ADMIN"
                      ? "bg-purple-800 text-white"
                      : "bg-gray-700 text-white"
                  }`}
                >
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  className={`px-3 py-1 text-sm font-semibold ${
                    user.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : user.status === "PENDING"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {user.status === "PENDING" && (
                      <DropdownMenuItem
                        onClick={() => resendInviteMutation.mutate(user._id)}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Resend Invite
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        updateUserMutation.mutate({
                          userId: user._id,
                          data: {
                            role: user.role === "USER" ? "ADMIN" : "USER",
                          },
                        })
                      }
                    >
                      Toggle Role
                    </DropdownMenuItem>
                    {user.status !== "PENDING" && (
                      <DropdownMenuItem
                        onClick={() =>
                          updateUserMutation.mutate({
                            userId: user._id,
                            data: {
                              status:
                                user.status === "ACTIVE"
                                  ? "DEACTIVATED"
                                  : "ACTIVE",
                            },
                          })
                        }
                      >
                        {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
