"use client";
import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";

const SelectModal = ({
  title,
  items,
  selectedItems = [],
  onConfirm,
  onCancel,
  emptyMessage = "No items available",
  thresholdLimit,
}) => {
  const [currentSelection, setCurrentSelection] = useState(selectedItems);

  useEffect(() => {
    setCurrentSelection(selectedItems);
  }, [selectedItems]);

  const handleItemClick = (itemId) => {
    setCurrentSelection((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      if (thresholdLimit && prev.length >= thresholdLimit) {
        return prev;
      }
      return [...prev, itemId];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-zinc-900/30">
      <div className="relative w-full max-w-4xl h-[90vh] flex flex-col bg-white/90 backdrop-blur-lg rounded-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-300">
          <h2 className="text-lg font-medium text-zinc-800">{title}</h2>

          <button
            onClick={onCancel}
            className="rounded text-zinc-500 hover:text-zinc-800 transition-colors p-2  hover:bg-zinc-300 border border-transparent hover:border-zinc-300"
            aria-label="Close modal"
          >
            <FiX size={20} className="stroke-current" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {items?.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const isSelected = currentSelection.includes(item._id);
                const isDisabled = thresholdLimit && currentSelection.length >= thresholdLimit && !isSelected;
                return (
                  <div
                    key={item._id}
                    onClick={() => !isDisabled && handleItemClick(item._id)}
                    className={`relative p-4 transition-all duration-200 border rounded cursor-pointer group
                      ${
                        isSelected
                          ? "border-primary border-y-2 bg-zinc-100"
                          : isDisabled
                          ? "bg-zinc-100 border-zinc-300 cursor-not-allowed opacity-50"
                          : "bg-white border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-3 right-1 bg-primary text-white text-xs px-2 py-1 rounded uppercase tracking-wider">
                        Selected
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {item.logo && (
                        <div className="flex-shrink-0 w-12 h-12 overflow-hidden bg-white border rounded center-flex border-zinc-500">
                          <img
                            src={item.logo}
                            alt={`${item.name} logo`}
                            className="object-cover w-full h-full"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://placehold.co/48/efefef/999999?text=${item.name.charAt(
                                0
                              )}`;
                            }}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3
                          className={`${
                            isSelected
                              ? "text-zinc-700 font-semibold"
                              : "text-zinc-800"
                          }`}
                        >
                          {item.name}
                        </h3>

                        {item.description && (
                          <p className="mt-1 text-sm text-zinc-600 line-clamp-2">
                            {item.description || "Description not available"}
                          </p>
                        )}

                        {item.subject && (
                          <div className="mt-2">
                            <span className="text-xs font-medium uppercase text-zinc-500">
                              Subject
                            </span>
                            <p className="text-sm text-zinc-700">
                              {item.subject || "Not specified"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-zinc-500">{emptyMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200">
          <button
            onClick={onCancel}
            className="btn btn-md btn-third"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(currentSelection)}
            disabled={currentSelection.length === 0}
            className={`btn btn-md
              ${
                currentSelection.length > 0
                  ? "btn-primary"
                  : "btn-second cursor-not-allowed"
              }`}
          >
            <FiCheck size={16} />
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectModal;
