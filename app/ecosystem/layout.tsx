import type { Metadata } from "next";
import "./ecosystem.css";

export const metadata: Metadata = {
  title: "VVVeco Ecosystem | Community Growth Layer of Venice AI",
  description:
    "Explore how Venice AI, VVV and VVVeco connect infrastructure, participation and global ecosystem adoption.",
};

export default function EcosystemLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
