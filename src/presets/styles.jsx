export const labelStyles = (type) => {
  const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
  switch (type) {
    case "mini":
      return `text-[0.6rem] ${baseStyles}`;
    case "xs":
      return `text-[0.6rem] ${baseStyles}`;
    case "sm":
      return `text-[0.65rem] ${baseStyles}`;
    case "md":
      return `text-sm ${baseStyles}`;
    case "lg":
      return `text-base ${baseStyles}`;
    case "xl":
      return `text-lg ${baseStyles}`;
    default:
      return `text-xs ${baseStyles}`;
  }
};

export const inputStyles =
  "w-full bg-zinc-50 rounded-sm border border-b-2 border-zinc-300 focus:border-primary text-sm px-3 py-2 text-zinc-800 outline-none placeholder-zinc-500 transition-all";

export const KeyValue = ({ label, value }) => {
  return (
    <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded-sm bg-zinc-50">
      <div className="flex items-center gap-1">
        <h2 className="text-xxs uppercase text-primary">{label} :</h2>
        <p className="text-xs text-zinc-600">{value}</p>
      </div>
    </div>
  );
};

export const getUrlParams = () => {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
};

export const LoadingSpinner = ({ type = "compo" }) => (
  <div
    className={`${
      type === "page" ? "h-screen goodboy" : "h-64"
    } center-flex flex-col gap-2`}
  >
    <h1
      className={` ${
        type === "page" ? "text-xl lg:text-3xl" : "text-sm xl:text-base"
      } font-medium text-zinc-600 animate-pulse`}
    >
      Processing!
    </h1>
    <div
      className={`${
        type === "page" && "mb-80 md:mb-32"
      } flex justify-center items-center relative`}
    >
      <div
        className={`${
          type === "page"
            ? "h-20 w-20 lg:w-24 lg:h-24"
            : "h-10 w-10 lg:w-12 lg:h-12"
        } border-2 border-zinc-300 border-t-zinc-700 animate-spin rounded-full`}
      />
      <div
        className={`${
          type === "page"
            ? "h-16 w-16 lg:w-20 lg:h-20"
            : "h-8 w-8 lg:w-10 lg:h-10"
        } absolute border-2 border-zinc-300 border-t-zinc-700 animate-spin rounded-full`}
      />
      <div
        className={`${
          type === "page" ? "h-12 w-12" : "h-6 w-6"
        } absolute bg-second animate-pulse rounded-full`}
      />
    </div>

    <h1
      className={`${
        type === "page" ? "hidden" : "text-sm xl:text-base"
      } font-medium text-zinc-600 animate-pulse`}
    >
      Processing!
    </h1>

    {type === "page" && (
      <div className="mt-8 text-center flex flex-col items-center">
        <p className="text-zinc-600 mb-2">If the page is taking too long to load</p>
        <button 
          onClick={() => window.location.reload()}
          className="btn btn-sm btn-primary-two"
        >
          Reload Page
        </button>
      </div>
    )}
  </div>
);

export const MiniCard = ({ title, subLine, size = "sm", style = "light" }) => {
  const TitleSizes = {
    xs: "text-xs transition-all",
    sm: "text-sm transition-all",
    md: "text-sm md:text-base lg:text-lg transition-all",
  };
  const SubLineSizes = {
    xs: "text-xxs transition-all",
    sm: "text-xs transition-all",
    md: "text-xs md:text-sm lg:text-base transition-all",
  };

  return (
    <div className="w-full flex items-center gap-2" key={title}>
      <div
        className={`${
          style === "light" ? "w-[1px]" : "w-[2px]"
        } h-full min-h-10 bg-second/80 rounded isolate`}
      />
      <div className="flex flex-col gap-1">
        <h2 className={`${TitleSizes[size]} text-primary font-medium`}>
          {title}
        </h2>
        <p className={`${SubLineSizes[size]} text-zinc-500`}>{subLine}</p>
      </div>
    </div>
  );
};

export const ToggleLiver = ({ key, checked, onChange }) => (
  <label
    htmlFor={key}
    className="relative inline-flex items-center cursor-pointer"
  >
    <input
      id={key}
      type="checkbox"
      name="isActive"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only peer"
    />
    <div
      className="relative w-12 h-6 rounded-sm bg-zinc-300 
        peer-focus:outline-none peer 
        peer-checked:bg-primary
        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
        after:bg-white after:rounded-full after:border-gray-300 after:border 
        after:h-5 after:w-5 
        after:transition-transform after:duration-200 after:ease-in-out
        peer-checked:after:translate-x-[22px]"
    ></div>
  </label>
);

export const Checkbox = ({ selected, onChange }) => (
  <div
    onClick={onChange}
    className={`w-5 h-5 rounded-sm border cursor-pointer transition-all duration-200 center-flex
    ${
      selected
        ? "bg-primary border-primary"
        : "border-zinc-300 hover:border-primary"
    }`}
  >
    {selected && (
      <svg
        className="w-4 h-4 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    )}
  </div>
);

export const ViewToggle = ({ viewMode, setViewMode, viewToggleOptions }) => (
  <div className="flex bg-zinc-100 border border-b-2 border-zinc-300 rounded-sm overflow-hidden py-1 px-1.5 gap-1">
    {viewToggleOptions.map(({ icon, value }) => (
      <button
        key={value}
        onClick={() => setViewMode(value)}
        className={`p-1.5 text-sm transition-all rounded-sm ${
          viewMode === value
            ? "bg-primary text-white"
            : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-300"
        }`}
        title={value}
      >
        {icon}
      </button>
    ))}
  </div>
);

export const TabToggle = ({
  label,
  currentTab,
  setCurrentTab,
  TabToggleOptions,
  size = "sm",
}) => {
  const sizes = {
    sm: "text-xs p-1.5",
    md: "text-xs md:text-sm py-1 px-2 md:py-1.5 md:px-3",
  };

  return (
    <div className="space-y-1">
      {label && <div className={labelStyles("base")}>{label}</div>}
      <div className="flex bg-zinc-100 border border-b-2 border-zinc-300 rounded-sm overflow-hidden py-1 px-1.5 gap-1">
        {TabToggleOptions.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setCurrentTab(value)}
            className={`${sizes[size]} transition-all rounded-sm ${
              currentTab === value
                ? "bg-primary text-white"
                : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-300"
            }`}
            title={value}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
