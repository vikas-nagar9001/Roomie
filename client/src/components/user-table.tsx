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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredUsers?.map((user) => (
          <TableRow key={user._id}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.role}</TableCell>
            <TableCell>
              <Badge
                variant={
                  user.status === "ACTIVE"
                    ? "default"
                    : user.status === "PENDING"
                    ? "secondary"
                    : "destructive"
                }
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
                          role: user.role === "USER" ? "CO_ADMIN" : "USER",
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
  );
}