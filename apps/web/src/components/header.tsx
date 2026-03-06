import { Link } from "@tanstack/react-router";

export default function Header() {
  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/generate", label: "Generate" },
    { to: "/queue", label: "Queue" },
    { to: "/hooks", label: "Hooks" },
    { to: "/analytics", label: "Analytics" },
    { to: "/settings", label: "Settings" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <nav className="flex gap-4 text-sm font-medium">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2" />
      </div>
      <hr />
    </div>
  );
}
