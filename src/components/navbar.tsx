import clsx from "clsx";
import { useCallback, useContext } from "react";
import ciber from "../assets/ciber.png";
import {
  Button,
  Navbar as NextUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle
} from "@heroui/react";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { AuthContext } from "@/contexts/Auth.tsx";
import { Link as RouterLink, NavLink, useNavigate } from "react-router-dom";

export const Navbar = () => {
  const { session, logOut } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    logOut();
    navigate("/");
  }, [logOut, navigate]);

  return (
    <NextUINavbar
      style={{ backgroundColor: "#000", opacity: "80%" }}
      maxWidth="full"
      position="sticky"
      classNames={{
        base: "mx-auto w-full px-0",
        wrapper: "mx-auto w-full max-w-7xl px-6",
      }}
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <RouterLink className="flex items-center justify-start gap-1" to="/">
            <img style={{ marginLeft: 10 }} src={ciber} alt="Ciber" className="h-12 object-contain" />
            <p style={{color: '#fff'}} className="font-bold text-inherit">Ligolo-ng Tunnel Manager</p>
          </RouterLink>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NavLink
                className={({ isActive }) =>
                  clsx(
                    "font-bold text-[#ffcc29] transition-opacity",
                    isActive ? "opacity-100" : "opacity-80 hover:opacity-100"
                  )
                }
                end={item.href === "/"}
                to={item.href}
              >
                {item.label}
              </NavLink>
            </NavbarItem>
          ))}
        </div>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full items-center gap-4"
        justify="end"
      >
        {session && (
          <NavbarItem>
            <Button color="danger" onPress={handleLogout} size="sm" variant="solid">
              <span style={{color: '#fff', fontWeight: 'bold'}}>Logout</span>
            </Button>
          </NavbarItem>
        )}

      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <NavLink
                className={({ isActive }) =>
                  clsx(
                    "text-lg font-bold text-[#ffcc29] transition-opacity",
                    isActive ? "opacity-100" : "opacity-80 hover:opacity-100"
                  )
                }
                end={item.href === "/"}
                to={item.href}
              >
                {item.label}
              </NavLink>
            </NavbarMenuItem>
          ))}
          {session && (
            <NavbarMenuItem>
              <Button color="danger" fullWidth onPress={handleLogout} size="sm">
                <span color="#fff">Logout</span>
              </Button>
            </NavbarMenuItem>
          )}
        </div>
      </NavbarMenu>
    </NextUINavbar>
  );
};
