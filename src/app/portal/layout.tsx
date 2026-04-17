import { Barlow, Barlow_Condensed } from "next/font/google";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${barlow.variable} ${barlowCondensed.variable}`}>
      {children}
    </div>
  );
}
