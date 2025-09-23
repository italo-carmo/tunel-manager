import clsx from "clsx";
import { useCallback, useContext } from "react";
import { link as linkStyles } from "@heroui/theme";
import ciber from "../assets/ciber.png";
import {
  Button,
  Link,
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
import { useNavigate } from "react-router-dom";

export const Navbar = () => {
  const { session, logOut } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    logOut();
    navigate("/");
  }, [logOut, navigate]);

  return (
    <NextUINavbar style={{backgroundColor: '#000', opacity: '80%'}} maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <Link
            className="flex justify-start items-center gap-1"
            color="foreground"
            href="/"
          >
        <img style={{ marginLeft: 10 }} src={ciber} alt="Ciber" className="h-12 object-contain" />
            <p style={{color: '#fff'}} className="font-bold text-inherit">Ligolo-ng Tunnel Manager</p>
          </Link>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <Link
              style={{color: '#ffcc29', fontWeight: 'bold'}}
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium"
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </Link>
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
              Logout
            </Button>
          </NavbarItem>
        )}
        <NavbarItem className="hidden sm:flex gap-2">
          <span style={{color: '#ffcc29', fontWeight: 'bold'}}>Dark Mode</span>
          <ThemeSwitch />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link color={"foreground"} href={item.href} size="lg">
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
          {session && (
            <NavbarMenuItem>
              <Button color="danger" fullWidth onPress={handleLogout} size="sm">
                Logout
              </Button>
            </NavbarMenuItem>
          )}
        </div>
      </NavbarMenu>
    </NextUINavbar>
  );
};
