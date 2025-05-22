import { LoginArea } from "@/components/auth/LoginArea";
import type React from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => (
  <div className={`flex justify-between items-center mb-2 ${className || ''}`}>
    <Link to="/" className="contents">
      <h1 className="text-5xl font-bold flex flex-row gap-0.5 items-baseline leading-none relative"> {/* Changed to text-4xl font-bold */}
        <span className="text-red-500 font-extrabold text-7xl relative top-[3px]">+</span> {/* Moved down by 0.5rem */}
        chorus
      </h1>
    </Link>
    <div className="flex items-center gap-2">
      <LoginArea />
    </div>
  </div>
);

export default Header;
