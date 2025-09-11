// components/Dropdown.jsx
import PropTypes from "prop-types";
import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiCheck } from "react-icons/fi";

/**
 * A simple, elegant dropdown component
 *
 * @param {object} props
 * @param {Array} props.options - Array of options {value, label}
 * @param {string|number} props.value - Currently selected value
 * @param {function} props.onChange - Callback when selection changes
 * @param {string} [props.placeholder='Select an option'] - Placeholder text
 * @param {string} [props.className=''] - Additional className for wrapper
 * @param {boolean} [props.disabled=false] - Whether dropdown is disabled
 * @param {string} [props.position='bottom'] - Dropdown position relative to trigger
 * @param {string} [props.size='md'] - Size variant of the dropdown
 */
export const Dropdown = ({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  isLoading = false,
  isHighLighted,
  position = "bottom",
  size = "md", // Size prop implementation
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case "Escape":
        setIsOpen(false);
        break;
      case "ArrowDown":
      case "ArrowUp":
        break;
      case "Enter":
        break;
    }
  };

  const handleSelect = React.useCallback(
    (optionValue) => {
      onChange(optionValue);
      setIsOpen(false);
    },
    [onChange]
  );

  // Positioning logic
  const positionClasses = {
    bottom: "top-full left-0 mt-1",
    right: "left-full top-0 ml-1",
    top: "bottom-full left-0 mb-1",
    left: "right-full top-0 mr-1",
    "bottom-right": "top-full right-0 mt-1",
    "bottom-left": "top-full left-0 mt-1",
    "top-right": "bottom-full right-0 mb-1",
    "top-left": "bottom-full left-0 mb-1",
    center: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
  };

  // Size classes for the trigger button
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-xs",
    lg: "px-4 py-3 text-sm",
  };

  // Size classes for the dropdown menu items
  const menuItemSizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-xs",
    lg: "px-4 py-2 text-sm",
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
    >
      <button
        type="button"
        className={`w-full max-w-md flex items-center justify-between gap-2.5 bg-white rounded-sm border border-b-2 transition-all 
          ${sizeClasses[size]}
          ${
            (isHighLighted && "border-third hover:border-yellow-500") || isOpen
              ? "border-zinc-400"
              : "border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400"
          }
          ${disabled ? "bg-zinc-100 cursor-not-allowed opacity-70" : ""}`}
        aria-haspopup="listbox"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={selectedOption?.label || placeholder}
      >
        <span
          className={`truncate ${
            selectedOption ? "text-zinc-800" : "text-zinc-500"
          }`}
        >
          {isLoading
            ? "Loading..."
            : selectedOption
            ? selectedOption.label
            : placeholder}
        </span>
        {isLoading ? (
          <Spinner className="h-4 w-4 text-zinc-500" />
        ) : (
          <FiChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute z-20 w-full min-w-48 rounded-sm bg-white border border-y-2 border-zinc-300 max-h-60 overflow-auto shadow-lg ${positionClasses[position]}`}
          role="listbox"
        >
          {options.length === 0 ? (
            <div className={`${menuItemSizeClasses[size]} text-zinc-500`}>
              No options available
            </div>
          ) : (
            <ul className="py-1">
              {options.map((option) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={`cursor-pointer between-flex gap-2 transition-all ${
                    menuItemSizeClasses[size]
                  } ${
                    option.value === value
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-200/70"
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value !== value && (
                    <div className="w-1.5 h-4 rounded-[2px] bg-third"></div>
                  )}
                  {option.value === value && (
                    <FiCheck className="h-4 w-4 text-yellow-600" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

Dropdown.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  isHighLighted: PropTypes.bool,
  position: PropTypes.oneOf(["bottom", "right", "top", "left"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

// Spinner component (if not already imported)
const Spinner = ({ className }) => (
  <div
    className={`animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-500 ${className}`}
  ></div>
);
