import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system", resolvedTheme = "light" } = useTheme();
  const [themeClock, setThemeClock] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setThemeClock(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const baseTheme = theme === "system" ? resolvedTheme : theme;
  const hour = new Date(themeClock).getHours();
  const isNightHour = hour >= 22 || hour < 5;
  const effectiveTheme = baseTheme === "light" && isNightHour ? "dark" : baseTheme;

  return (
    <Sonner
      theme={effectiveTheme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
