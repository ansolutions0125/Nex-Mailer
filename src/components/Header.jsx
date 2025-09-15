import { FiPlus } from "react-icons/fi";

const Header = ({
  title = "Dashboard",
  subtitle = "Welcome to your dashboard",
  buttonText = "Add New",
  onButtonClick = () => {},
  hideButton = false
}) => {
  return (
    <div className="flex flex-col justify-between gap-4 mb-8 md:flex-row md:items-center">
      <div className="space-y-1">
        <h1 className="flex items-center gap-3 text-xl lg:text-2xl font-medium text-zinc-800">
          <span className="relative flex items-center justify-center">
            <span className="absolute inline-flex w-4 h-4 rounded-full opacity-75 animate-ping bg-zinc-400"></span>
            <span className="relative inline-flex w-3 h-3 rounded-full bg-zinc-500"></span>
          </span>
          {title}
        </h1>
        <p className="text-sm text-zinc-600">{subtitle}</p>
      </div>
      {!hideButton && (
        <button
          onClick={onButtonClick}
          className="btn btn-sm md:btn-md btn-primary w-fit"
        >
          <FiPlus className="w-4 h-4" />
          {buttonText}
        </button>
      )}
    </div>
  );
};

export default Header;
