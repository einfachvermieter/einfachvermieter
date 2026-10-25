import {
  RiLockPasswordLine,
  RiLogoutBoxRLine,
  RiUserSettingsLine,
} from "@remixicon/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { t } from "@/lib/i18n";
import { IconChevronDown, IconUser } from "@/lib/icons";
import { PasswordSheet } from "@/pages/settings/PasswordSheet";
import { ProfileSheet } from "@/pages/settings/ProfileSheet";

export const MainNavigationUser = ({
  email,
  firstName,
  lastName,
  onLogout,
}: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  onLogout: () => void;
}) => {
  // Profil und Passwort öffnen als Sheet ohne Navigation
  const [sheet, setSheet] = useState<"profile" | "password" | null>(null);

  // Voller Name als primäre Zeile, E-Mail darunter; ohne Namen die E-Mail
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName = fullName || email;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <Button variant="ghost">
            <IconUser aria-hidden={true} />
            <span className="max-w-48 truncate max-md:sr-only">
              {displayName}
            </span>
            <IconChevronDown aria-hidden={true} className="max-md:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-56"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <DropdownMenuLabel className="flex min-w-0 flex-col">
            {fullName ? (
              <span className="truncate text-sm font-semibold text-popover-foreground">
                {fullName}
              </span>
            ) : null}
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSheet("profile")}>
            <RiUserSettingsLine />
            {t("ui.settings.profile.title")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSheet("password")}>
            <RiLockPasswordLine />
            {t("ui.settings.password.title")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout}>
            <RiLogoutBoxRLine />
            {t("ui.common.action.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {sheet === "profile" ? (
        <ProfileSheet onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "password" ? (
        <PasswordSheet onClose={() => setSheet(null)} />
      ) : null}
    </>
  );
};
