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

export const MiniCard = ({ title, subLine }) => (
  <div className="w-full flex items-center gap-2">
    <div className="w-[1px] h-full min-h-10 bg-zinc-400 rounded" />
    <div className="flex flex-col gap-1">
      <h2 className="text-sm text-primary">{title}</h2>
      <p className="text-xs text-zinc-500">{subLine}</p>
    </div>
  </div>
);

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
