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
      <h1 className="text-4xl font-bold flex flex-row gap-0 items-center"> {/* Changed to text-4xl font-bold */}
        <span className="text-red-500 font-extrabold text-5xl">+</span> {/* Changed to text-5xl */}
        chorus
      </h1>
    </Link>
    <div className="flex items-center gap-2">
      <NotificationBell />
      <LoginArea />
    </div>
  </div>
);

export default Header;
