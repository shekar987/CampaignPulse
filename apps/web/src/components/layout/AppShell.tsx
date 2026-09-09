import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";

import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import styles from "./AppShell.module.css";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", icon: "layout-grid", end: true },
  { to: "/campaigns", label: "Campaigns", icon: "megaphone" },
  { to: "/incidents", label: "Incidents", icon: "siren" },
  { to: "/dead-letters", label: "Dead letters", icon: "archive" },
];

const SIDEBAR_ID = "app-sidebar";

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // While the drawer is open, move focus into it and let Escape close it.
  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    sidebarRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <div className={styles.shell}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to main content
      </a>

      <aside
        id={SIDEBAR_ID}
        ref={sidebarRef}
        aria-label="Main navigation"
        className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}
      >
        <Link
          to="/"
          className={styles.brand}
          aria-label="CampaignPulse overview"
          onClick={() => setDrawerOpen(false)}
        >
          <span className={styles.brandMark}>
            <Icon name="pulse" size={18} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>CampaignPulse</span>
            <span className={styles.brandTagline}>Delivery reliability</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
              }
            >
              <Icon name={item.icon} size={18} />
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <p className={styles.sidebarFooter}>
          Synthetic demo data. Not affiliated with any retailer.
        </p>
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          className={styles.overlay}
          aria-label="Close navigation"
          onClick={closeDrawer}
        />
      ) : null}

      <header className={styles.topbar}>
        <Button
          ref={menuButtonRef}
          variant="ghost"
          size="sm"
          className={styles.menuButton}
          aria-controls={SIDEBAR_ID}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          onClick={() => (drawerOpen ? closeDrawer() : setDrawerOpen(true))}
          icon={<Icon name={drawerOpen ? "close" : "menu"} size={20} />}
        />
        <p className="text-sm font-medium text-fg-secondary">
          Retail Media Delivery Reliability Platform
        </p>
        <span className="ml-auto rounded-full border border-line bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-fg-secondary">
          Demo environment
        </span>
      </header>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
