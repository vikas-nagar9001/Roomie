import { useState, useEffect } from "react";
import { FiUser } from "react-icons/fi";
import { FaTrash } from "react-icons/fa";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, MoreVertical, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import ResponsivePagination from "react-responsive-pagination";
import { CustomPagination } from "@/components/custom-pagination";
import "react-responsive-pagination/themes/classic.css";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showLoader, hideLoader } from "@/services/loaderService";
import { showSuccess, showError } from "@/services/toastService";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface UserTableProps {
  search: string;
  onLoadComplete?: () => void;
}

// Utility function to get initials from name
const getInitials = (name: string) => {
  if (!name) return "";
  // Split by spaces and filter out empty strings
  const words = name.split(" ").filter((word) => word.length > 0);
  // Get the first letter of each word and convert to uppercase
  const initials = words.map((word) => word[0]?.toUpperCase() || "");
  // Return all initials, no limit
  return initials.join("");
};

export function UserTable({ search, onLoadComplete }: UserTableProps) {
  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/allUsers"],
  });
  // Hide loader when data fetching is done
  useEffect(() => {
    // When loading is complete, hide the loader
    if (!usersLoading && users) {
      // Small delay to ensure all rendering is complete
      setTimeout(() => {
        hideLoader();
        // Call the onLoadComplete callback if provided
        if (onLoadComplete) {
          onLoadComplete();
        }
      }, 300);
    }
  }, [usersLoading, users, onLoadComplete]);

  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<User>;
    }) => {
      showLoader();
      try {
        const res = await apiRequest("PATCH", `/api/users/${userId}`, data);
        return res.json();
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: (updatedUser, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/allUsers"] });

      // If the updated user is the current user and the role was changed
      if (variables.userId === currentUser?._id && "role" in variables.data) {
        // Show a message and redirect to dashboard
        showSuccess("Your role has been updated. Redirecting to dashboard...");
        setTimeout(() => {
          // Navigate to dashboard and force a page reload
          navigate("/");
          window.location.reload();
        }, 1500);
      } else if ("status" in variables.data) {
        // Status update was handled in the click handler
      } else if ("role" in variables.data) {
        // Role update for other users was handled in the click handler
      }

      hideLoader();
    },
    onError: (error: Error) => {
      showError("Update failed: " + error.message);
      hideLoader();
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      showLoader();
      try {
        await apiRequest("POST", `/api/users/${userId}/resend-invite`);
      } catch (error) {
        hideLoader();
        throw error;
      }
    },
    onSuccess: () => {
      showSuccess("Invite has been resent successfully");
      hideLoader();
    },
    onError: (error: Error) => {
      showError("Failed to resend invite: " + error.message);
      hideLoader();
    },
  });

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToDeleteDetails, setUserToDeleteDetails] = useState<User | null>(
    null
  );

  const usersPerPage = 4;

  // Filtered users based on search input
  const filteredUsers =
    users?.filter(
      (user) =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
    ) || [];

  // Paginate users
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );
  const handleDeleteUser = async () => {
    if (!userToDelete || !userToDeleteDetails) return;

    showLoader();
    try {
      const response = await fetch(`/api/users/${userToDelete}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      // Invalidate the query to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["/api/allUsers"] });

      showSuccess(`${userToDeleteDetails.name} has been successfully deleted.`);
    } catch (error) {
      console.error("Error:", error);
      showError("Failed to delete user. Please try again.");
    } finally {
      // Ensure the loader is hidden
      setTimeout(() => {
        hideLoader();
      }, 300);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      {paginatedUsers?.length > 0 ? (
        <Table className="w-full overflow-x-auto bg-[#151525] rounded-xl border-none">
          <TableHeader>
            <TableRow className="border-none">
              <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none whitespace-nowrap min-w-[200px]">
                <span className="block">User</span>
              </TableHead>
              <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none">
                Role
              </TableHead>
              <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none">
                Status
              </TableHead>
              <TableHead className="text-left text-indigo-200/80 font-semibold py-3 px-3 border-none">
                Created
              </TableHead>
              <TableHead className="text-center text-indigo-200/80 font-semibold py-3 border-none">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers?.map((user) => (
              <TableRow
                key={user._id}
                className="transition duration-200 hover:bg-[#1f1f2e] hover:shadow-inner border-none"
              >
                <TableCell className="min-w-[200px] py-4 px-3">
                  <div className="flex items-center gap-3 p-2 rounded-lg border border-[#582c84]/30 bg-[#1c1b2d] shadow-sm">
                    <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#582c84]/50">
                      <AvatarImage
                        src={user.profilePicture}
                        alt={user.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-[#1a1a2e] text-white text-lg">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">
                        {user.name}
                      </p>
                      <p
                        className="text-sm text-white/60 truncate hover:text-clip hover:whitespace-normal"
                        title={user.email}
                      >
                        {user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4 px-3">
                  <span
                    className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                      user.role === "ADMIN"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                        : user.role === "CO_ADMIN"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                    } transition-all duration-200`}
                  >
                    {user.role}
                  </span>
                </TableCell>
                <TableCell className="py-4 px-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        user.status === "ACTIVE"
                          ? "bg-emerald-400 animate-pulse"
                          : user.status === "PENDING"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                    />
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                        user.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : user.status === "PENDING"
                          ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30"
                      } transition-all duration-200`}
                    >
                      {user.status}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-white/60 py-4 px-3">
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                  }).format(new Date(user.createdAt))}
                </TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-[#582c84]/20 text-white/70"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-[#151525] border border-[#582c84]/30"
                    >
                      {user.status === "PENDING" && (
                        <DropdownMenuItem
                          onClick={() => resendInviteMutation.mutate(user._id)}
                          className="text-white hover:bg-[#582c84]/20"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Resend Invite
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          const newRole = user.role === "USER" ? "ADMIN" : "USER";
                          updateUserMutation.mutate({
                            userId: user._id,
                            data: {
                              role: newRole,
                            },
                          });
                          // Show feedback message right away if this is the current user
                          if (user._id != currentUser?._id) {
                            showSuccess(`User role updated to ${newRole}`);
                        }
                        }}
                        className="text-white hover:bg-[#582c84]/20"
                      >
                        Toggle Role
                      </DropdownMenuItem>
                      {user.status !== "PENDING" && (
                        <DropdownMenuItem
                          className="text-white hover:bg-[#582c84]/20"
                          onClick={() => {
                            const newStatus = user.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
                            updateUserMutation.mutate({
                              userId: user._id,
                              data: {
                                status: newStatus,
                              },
                            });
                            showSuccess(`User ${newStatus === "ACTIVE" ? "activated" : "deactivated"} successfully`);
                          }}
                        >
                          {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        onClick={() => {
                          setUserToDelete(user._id);
                          setUserToDeleteDetails(user);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-8 text-center text-white/60">
          <div className="flex flex-col items-center justify-center space-y-3">
            <FiUser className="w-12 h-12 text-[#582c84] opacity-50" />
            <p className="text-lg font-medium">No users found</p>
            <p className="text-sm text-white/40">
              Try adjusting your search or add new users
            </p>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center mt-4 mb-20 md:mb-4">
          <CustomPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete User"
        onConfirm={handleDeleteUser}
        description={
          <div className="flex items-center gap-3 p-2 rounded-lg border border-red-500/30 bg-red-500/10">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/20 border border-red-500/30">
              <FiUser className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">
                {userToDeleteDetails?.name}
              </span>
              <span className="text-xs text-white/60">
                {userToDeleteDetails?.email}
              </span>
            </div>
          </div>
        }
        confirmText="Delete User"
        className="sm:max-w-md border-red-500/20 bg-[#151525]"
        variant="destructive"
      />
    </div>
  );
}
