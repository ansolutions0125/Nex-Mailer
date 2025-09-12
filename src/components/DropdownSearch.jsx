
// components/DropdownSearch.jsx
import PropTypes from "prop-types";
import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiCheck, FiSearch, FiX } from "react-icons/fi";

/**
 * A dropdown component with search functionality
 *
 * @param {object} props
 * @param {Array} props.options - Array of options {value, label}
 * @param {string|number} props.value - Currently selected value
 * @param {function} props.onChange - Callback when selection changes
 * @param {string} [props.placeholder='Select an option'] - Placeholder text
 * @param {string} [props.className=''] - Additional className for wrapper
 * @param {boolean} [props.disabled=false] - Whether dropdown is disabled
 * @param {string} [props.position='bottom'] - Dropdown position relative to trigger
 * @param {boolean} [props.isLoading=false] - Loading state
 * @param {boolean} [props.isHighLighted=false] - Highlight state
 * @param {string} [props.searchPlaceholder='Search...'] - Search input placeholder
 */


export const DropdownSearch = ({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  isLoading = false,
  isHighLighted = false,
  position = "bottom",
  searchPlaceholder = "Search...",
  size = "md", // Size prop implementation
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

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

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearchTerm("");
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (focusedIndex >= 0 && optionsListRef.current) {
      const optionElements =
        optionsListRef.current.querySelectorAll('li[role="option"]');
      if (optionElements[focusedIndex]) {
        optionElements[focusedIndex].scrollIntoView({
          block: "nearest",
        });
      }
    }
  }, [focusedIndex]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        setIsOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          Math.min(prev + 1, filteredOptions.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          e.preventDefault();
          handleSelect(filteredOptions[focusedIndex].value);
        }
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(filteredOptions.length - 1);
        break;
      default:
        // Focus search input when typing letters/numbers
        if (e.key.length === 1 && searchInputRef.current) {
          searchInputRef.current.focus();
        }
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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setFocusedIndex(-1);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setFocusedIndex(-1);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Positioning logic
  const positionClasses = {
    bottom: "top-full left-0 mt-1",
    right: "left-full top-0 ml-1",
    top: "bottom-full left-0 mb-1",
    left: "right-full top-0 mr-1",
    "bottom-start": "top-full left-0 mt-1",
    "bottom-end": "top-full right-0 mt-1",
    "top-start": "bottom-full left-0 mb-1",
    "top-end": "bottom-full right-0 mb-1",
    "right-start": "left-full top-0 ml-1",
    "right-end": "left-full bottom-0 ml-1",
    "left-start": "right-full top-0 mr-1",
    "left-end": "right-full bottom-0 mr-1",
    center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    "top-left": "bottom-full left-0 mb-1",
    "top-right": "bottom-full right-0 mb-1",
    "bottom-left": "top-full left-0 mt-1",
    "bottom-right": "top-full right-0 mt-1",
    "left-top": "right-full top-0 mr-1",
    "left-bottom": "right-full bottom-0 mr-1",
    "right-top": "left-full top-0 ml-1",
    "right-bottom": "left-full bottom-0 ml-1",
  };

   // Size classes for the trigger button
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2.5 text-xs",
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
      className={`w-full relative ${className}`}
      onKeyDown={handleKeyDown}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls="dropdown-options"
    >
      <button
        type="button"
        className={`w-full max-w-md flex items-center justify-between gap-2 bg-white rounded-sm border border-b-2 transition-all 
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
          className={`absolute z-10 w-full min-w-48 rounded-md bg-white border border-zinc-300 max-h-60 overflow-auto shadow-lg ${positionClasses[position]}`}
          role="listbox"
          id="dropdown-options"
        >
          <div className="sticky top-0 bg-white p-2 border-b border-zinc-200">
            <div className="relative">
              <FiSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="w-full bg-zinc-50 text-xs rounded-sm border border-b-2 border-zinc-300 focus:border-primary px-4 pl-7 py-1.5 text-zinc-800 outline-none placeholder-zinc-500"
                aria-label="Search options"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  aria-label="Clear search"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredOptions.length === 0 ? (
            <div className="px-4 py-2 text-xs text-zinc-500">
              {searchTerm ? "No matches found" : "No options available"}
            </div>
          ) : (
            <ul className="py-1" ref={optionsListRef}>
              {filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={`px-4 py-2 text-xs cursor-pointer between-flex gap-2 transition-all ${
                    option.value === value
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-200/70"
                  } ${index === focusedIndex ? "bg-zinc-200/70" : ""}`}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <FiCheck className="h-4 w-4 text-zinc-600" />
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

DropdownSearch.propTypes = {
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
  searchPlaceholder: PropTypes.string,
};

// Simple spinner component (you can replace with your own)
const Spinner = ({ className }) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);
