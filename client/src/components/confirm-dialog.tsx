import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  className?: string;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = "Continue",
  cancelText = "Cancel",
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] max-w-[400px] w-[calc(100%-48px)] sm:w-full p-6 sm:p-8 m-0 rounded-lg shadow-lg bg-[#151525] border border-[#582c84]/30">
        <AlertDialogHeader className="space-y-4">
          <AlertDialogTitle className="text-lg font-semibold text-white">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/70 text-sm leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-4 mt-8">
          <AlertDialogCancel className="flex-1 px-6 py-2.5 bg-white/5 text-white hover:bg-white/10 border-white/10 transition-colors">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="flex-1 px-6 py-2.5 bg-[#582c84] hover:bg-[#542d87] text-white border-none transition-colors"
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}