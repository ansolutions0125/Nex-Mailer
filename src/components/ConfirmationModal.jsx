// components/ConfirmationModal.jsx
import React from "react";

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isDestructive = false,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) => {
  if (!isOpen) {
    return null;
  }

  // Determine button styles based on the destructive flag
  const confirmButtonClasses = isDestructive
    ? "btn btn-sm btn-red-600 center-flex gap-2"
    : "btn btn-sm btn-primary center-flex gap-2";

  return (
    <div className="fixed inset-0 w-full h-screen bg-black/50 backdrop-blur-sm center-flex z-50 p-4">
      <div className="bg-white border border-zinc-200 w-full max-w-md shadow-xl">
        <div className="p-5 border-b border-zinc-200">
          <h2 className="text-xl text-primary">{title}</h2>
        </div>
        <div className="p-5 text-zinc-700">
          <p>{message}</p>
        </div>
        <div className="p-5 border-t border-zinc-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn btn-md "
          >
            {cancelText}
          </button>
          <button onClick={onConfirm} className="btn btn-md btn-primary">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
