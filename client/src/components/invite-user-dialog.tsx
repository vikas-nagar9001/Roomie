import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const inviteUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      await apiRequest("POST", "/api/users/invite", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onOpenChange(false);
      setName("");
      setEmail("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[40vh] max-w-80 w-full p-6 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">Invite User</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inviteUserMutation.mutate({ name, email });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/80">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-white/10 bg-black/30 text-white rounded-lg focus:ring-2 focus:ring-[#582c84] outline-none transition"
            />
          </div>
          <Button
            type="submit"
            disabled={inviteUserMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#582c84] hover:bg-[#542d87] text-white rounded-lg transition"
            >
            Send Invite
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
