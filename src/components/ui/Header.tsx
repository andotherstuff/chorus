import { LoginArea } from "@/components/auth/LoginArea";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type React from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => (
  <div className={`flex justify-between items-center mb-2 ${className || ''}`}>
    <Link to="/" className="contents">
      <h1 className="text-3xl md:text-4xl font-bold flex flex-row gap-0 items-center">
        <span className="text-red-500 font-extrabold text-4xl md:text-5xl">+</span>
        chorus
      </h1>
    </Link>
    <div className="flex items-center gap-2">
      <div className="md:hidden">
        <LoginArea />
      </div>
      <div className="hidden md:block">
        <NotificationBell />
        <LoginArea />
      </div>
    </div>
  </div>
);

export default Header;
