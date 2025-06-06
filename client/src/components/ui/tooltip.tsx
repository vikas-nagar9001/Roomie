import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function useHasHover() {
  try {
    return matchMedia('(hover: hover)').matches;
  } catch {
    // Assume that if browser too old to support matchMedia it's likely not a touch device
    return true;
  }
}

type TooltipTriggerContextType = {
  supportMobileTap: boolean;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const TooltipTriggerContext = React.createContext<TooltipTriggerContextType>({
  supportMobileTap: false,
  open: false,
  setOpen: () => {},
});

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip: React.FC<
  TooltipPrimitive.TooltipProps & { supportMobileTap?: boolean }
> = ({ children, ...props }) => {
  const [open, setOpen] = React.useState<boolean>(props.defaultOpen ?? false);
  const hasHover = useHasHover();

  return (
    <TooltipPrimitive.Root
      delayDuration={
        !hasHover && props.supportMobileTap ? 0 : props.delayDuration
      }
      onOpenChange={setOpen}
      open={open}
    >
      <TooltipTriggerContext.Provider
        value={{
          open,
          setOpen,
          supportMobileTap: props.supportMobileTap ?? false,
        }}
      >
        {children}
      </TooltipTriggerContext.Provider>
    </TooltipPrimitive.Root>
  );
};
Tooltip.displayName = TooltipPrimitive.Root.displayName;

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ children, ...props }, ref) => {
  const hasHover = useHasHover();
  const { setOpen, supportMobileTap } = React.useContext(TooltipTriggerContext);

  const { onClick: onClickProp } = props;

  const onClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!hasHover && supportMobileTap) {
        e.preventDefault();
        setOpen(true);
      } else {
        onClickProp?.(e);
      }
    },
    [setOpen, hasHover, supportMobileTap, onClickProp],
  );

  return (
    <TooltipPrimitive.Trigger ref={ref} {...props} onClick={onClick}>
      {children}
    </TooltipPrimitive.Trigger>
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
