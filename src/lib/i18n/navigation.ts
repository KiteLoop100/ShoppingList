import { createSharedPathnamesNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, useRouter, usePathname } =
  createSharedPathnamesNavigation(routing);
