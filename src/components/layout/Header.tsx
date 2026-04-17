import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LogOut } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export async function Header() {
  const session = await auth();
  const displayName = session?.user?.name ?? session?.user?.email ?? "Unknown User";
  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
      {/* Left: user identity */}
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 ring-2 ring-primary/20">
          <AvatarImage src={session?.user?.image ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden sm:block">
          <p className="text-xs text-muted-foreground leading-none mb-0.5">Signed in as</p>
          <p className="text-sm font-semibold leading-none">{displayName}</p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <div className="mx-1 h-5 w-px bg-border" />
        <Tooltip>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <TooltipTrigger
              render={<button
                type="submit"
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Sign out"
              />}
            >
              <LogOut className="h-4 w-4" />
            </TooltipTrigger>
          </form>
          <TooltipContent side="bottom">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
