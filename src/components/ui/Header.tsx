import { LoginArea } from "@/components/auth/LoginArea";
import type React from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => (
  <div className={`flex justify-between items-center mb-2 ${className || ''}`}>
    <Link to="/" className="contents">
      <h1 className="text-5xl font-bold flex flex-row gap-0.5 items-center leading-none relative">
        <span className="text-red-500 font-extrabold text-7xl relative -top-[6px]">+</span>
        chorus
      </h1>
    </Link>
    <div className="flex items-center gap-2">
      <LoginArea />
    </div>
  </div>
);

export default Header;
